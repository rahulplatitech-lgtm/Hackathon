"""
Tests for ML & DL models in CrisisSync AI:
- SeverityPredictor (Random Forest & XGBoost Ensemble)
- Federated Learning Manager (FedAvg & SGD)
- Model prediction latency and output validity
"""
import pytest
from app.ml.severity_predictor import severity_predictor, SeverityPredictor
from app.ml.federated import federated_manager, FederatedLearningManager

def test_severity_predictor_initialization():
    """Verify severity predictor initializes and trains models."""
    predictor = SeverityPredictor()
    assert predictor.is_trained is True
    assert predictor.rf_model is not None
    assert predictor.xgb_model is not None

def test_severity_predictor_inference():
    """Test multi-model ensemble severity inference."""
    critical_incident = {
        "type": "Building Collapse with structural fire",
        "urgency": "CRITICAL",
        "people_affected": 25,
        "required_resources": ["AMBULANCE", "RESCUE_TEAM", "MEDICAL_UNIT"]
    }
    result = severity_predictor.predict_severity(critical_incident)
    assert "predicted_severity" in result
    assert result["predicted_severity"] in [1, 2, 3, 4, 5]
    assert result["confidence"] > 0.6
    assert "random_forest" in result["model_predictions"]
    assert "xgboost" in result["model_predictions"]

def test_severity_predictor_low_severity():
    """Test low severity incident predictions."""
    minor_incident = {
        "type": "Minor cat rescue from tree",
        "urgency": "LOW",
        "people_affected": 0,
        "required_resources": []
    }
    result = severity_predictor.predict_severity(minor_incident)
    assert result["predicted_severity"] <= 3

def test_federated_learning_rounds():
    """Test federated learning manager aggregation round."""
    manager = FederatedLearningManager(n_nodes=3)
    round_result = manager.run_round(method="fedavg")
    assert round_result["round"] == 1
    assert round_result["n_nodes"] == 3
    assert manager.global_weights is not None
    assert len(manager.global_weights) == 7
