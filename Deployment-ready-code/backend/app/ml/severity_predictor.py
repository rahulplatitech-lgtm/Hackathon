"""XGBoost and Random Forest models for severity prediction.
Enhances the priority/triage agent with ML-based severity assessment."""
import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    logger.warning("XGBoost not available, using fallback")

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

class SeverityPredictor:
    """Ensemble severity predictor using XGBoost + Random Forest."""

    def __init__(self):
        self.xgb_model = None
        self.rf_model = None
        self.label_encoder = None
        self.is_trained = False
        self._train_on_synthetic_data()

    def _generate_synthetic_data(self, n_samples: int = 500):
        """Generate synthetic training data for severity prediction."""
        np.random.seed(42)
        features = []
        labels = []

        for _ in range(n_samples):
            people = np.random.randint(1, 50)
            urgency = np.random.choice([1, 2, 3, 4, 5])
            has_fire = np.random.randint(0, 2)
            has_collapse = np.random.randint(0, 2)
            has_medical = np.random.randint(0, 2)
            resource_count = np.random.randint(1, 6)
            time_since_report = np.random.uniform(0, 120)

            features.append([people, urgency, has_fire, has_collapse, has_medical,
                           resource_count, time_since_report])

            # Severity label based on features
            score = (people / 50) * 2 + (urgency / 5) * 2 + has_fire + has_collapse
            if score > 4:
                labels.append(5)
            elif score > 3:
                labels.append(4)
            elif score > 2:
                labels.append(3)
            elif score > 1:
                labels.append(2)
            else:
                labels.append(1)

        return np.array(features), np.array(labels)

    def _train_on_synthetic_data(self):
        """Train models on synthetic data."""
        X, y = self._generate_synthetic_data()

        if HAS_XGBOOST:
            try:
                # XGBoost requires 0-indexed classes [0, 1, 2, 3, 4] for 5 classes
                y_xgb = y - 1
                self.xgb_model = XGBClassifier(
                    n_estimators=100, max_depth=5, learning_rate=0.1,
                    objective="multi:softmax", num_class=5,
                    eval_metric="mlogloss",
                    verbosity=0,
                )
                self.xgb_model.fit(X, y_xgb)
                logger.info("XGBoost model trained successfully")
            except Exception as e:
                logger.warning(f"XGBoost training failed: {e}")

        if HAS_SKLEARN:
            try:
                self.rf_model = RandomForestClassifier(
                    n_estimators=100, max_depth=10, random_state=42
                )
                self.rf_model.fit(X, y)
                logger.info("Random Forest model trained successfully")
            except Exception as e:
                logger.warning(f"RF training failed: {e}")

        self.is_trained = self.xgb_model is not None or self.rf_model is not None

    def predict_severity(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict severity using ensemble of XGBoost + RF."""
        features = self._extract_features(incident_data)
        predictions = []

        if self.xgb_model:
            try:
                # Map 0-indexed prediction [0..4] back to [1..5]
                xgb_pred = int(self.xgb_model.predict(features.reshape(1, -1))[0]) + 1
                predictions.append(("xgboost", xgb_pred))
            except Exception:
                pass

        if self.rf_model:
            try:
                rf_pred = int(self.rf_model.predict(features.reshape(1, -1))[0])
                predictions.append(("random_forest", rf_pred))
            except Exception:
                pass

        if not predictions:
            return {"predicted_severity": incident_data.get("severity", 3),
                    "model": "fallback", "confidence": 0.5}

        # Ensemble: average predictions
        avg_pred = sum(p[1] for p in predictions) / len(predictions)
        final = max(1, min(5, round(avg_pred)))

        return {
            "predicted_severity": final,
            "model_predictions": {name: val for name, val in predictions},
            "ensemble_method": "average",
            "confidence": 0.85 if len(predictions) > 1 else 0.75,
        }

    def _extract_features(self, data: Dict[str, Any]) -> np.ndarray:
        """Extract features from incident data."""
        urgency_map = {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2}
        inc_type = data.get("type", "").lower()

        return np.array([
            data.get("people_affected", 1),
            urgency_map.get(data.get("urgency", "MEDIUM"), 3),
            1 if "fire" in inc_type else 0,
            1 if "collapse" in inc_type or "building" in inc_type else 0,
            1 if "medical" in inc_type else 0,
            len(data.get("required_resources", [])),
            0,  # time_since_report placeholder
        ])

severity_predictor = SeverityPredictor()
