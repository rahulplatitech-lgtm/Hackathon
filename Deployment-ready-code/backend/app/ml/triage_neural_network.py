"""PyTorch Multi-Task Deep Neural Network for Emergency Clinical Triage.
Trained on extensive 911/112 emergency calls to predict:
1. Incident Category
2. Severity Rating (1-5)
3. Clinical Entities (has_bleeding, is_unconscious, breathing_distress, fire_spreading, is_trapped)
4. Next Best Diagnostic Action & Question
"""
import os
import pickle
from typing import Dict, Any, List, Optional
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from app.ml.emergency_triage_dataset import get_augmented_triage_dataset

MODEL_WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "triage_dnn_model.pt")
VECTORIZER_PATH = os.path.join(os.path.dirname(__file__), "triage_vectorizer.pkl")

CATEGORIES = [
    "Medical Emergency",
    "Fire Emergency",
    "Road Accident",
    "Gas Leak",
    "Building Collapse",
    "General Emergency"
]

ACTIONS = [
    "check_breathing",
    "check_responsiveness",
    "check_head_bleeding",
    "immediate_cpr",
    "cardiac_assessment",
    "hemorrhage_control",
    "penetrating_trauma",
    "compound_fracture",
    "grease_fire_evacuation",
    "structure_fire_rescue",
    "electrical_fire_safety",
    "wildfire_structure_spread",
    "vehicle_extrication",
    "multi_casualty_traffic",
    "pinned_driver_rescue",
    "gas_leak_evacuation",
    "toxic_gas_rescue",
    "collapse_entrapment",
    "falling_debris_strike",
    "general_inquiry"
]

class TriageMultiTaskDNN(nn.Module):
    def __init__(self, input_dim: int, num_categories: int, num_actions: int):
        super().__init__()
        self.shared_backbone = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.25),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.2)
        )
        self.category_head = nn.Linear(128, num_categories)
        self.severity_head = nn.Linear(128, 1)
        self.entities_head = nn.Linear(128, 5)  # bleeding, unconscious, breathing, fire, trapped
        self.action_head = nn.Linear(128, num_actions)

    def forward(self, x):
        features = self.shared_backbone(x)
        cat_logits = self.category_head(features)
        severity_val = self.severity_head(features)
        entity_logits = self.entities_head(features)
        action_logits = self.action_head(features)
        return cat_logits, severity_val, entity_logits, action_logits


class TriageDataset(Dataset):
    def __init__(self, X, y_cat, y_sev, y_ent, y_act):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y_cat = torch.tensor(y_cat, dtype=torch.long)
        self.y_sev = torch.tensor(y_sev, dtype=torch.float32).unsqueeze(1)
        self.y_ent = torch.tensor(y_ent, dtype=torch.float32)
        self.y_act = torch.tensor(y_act, dtype=torch.long)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y_cat[idx], self.y_sev[idx], self.y_ent[idx], self.y_act[idx]


class TriageNeuralPredictor:
    def __init__(self):
        self.vectorizer: TfidfVectorizer = None
        self.model: TriageMultiTaskDNN = None
        self.is_trained = False
        self._initialize_or_train()

    def _initialize_or_train(self):
        if os.path.exists(MODEL_WEIGHTS_PATH) and os.path.exists(VECTORIZER_PATH):
            try:
                with open(VECTORIZER_PATH, "rb") as f:
                    self.vectorizer = pickle.load(f)
                num_features = len(self.vectorizer.get_feature_names_out())
                self.model = TriageMultiTaskDNN(num_features, len(CATEGORIES), len(ACTIONS))
                self.model.load_state_dict(torch.load(MODEL_WEIGHTS_PATH, map_location="cpu"))
                self.model.eval()
                self.is_trained = True
                return
            except Exception as e:
                print(f"Error loading trained triage model: {e}. Retraining now...")

        self.train_model()

    def train_model(self) -> Dict[str, float]:
        """Trains the PyTorch Multi-Task DNN on the augmented emergency dataset."""
        data = get_augmented_triage_dataset()
        texts = [d["text"] for d in data]

        cat_map = {c: i for i, c in enumerate(CATEGORIES)}
        act_map = {a: i for i, a in enumerate(ACTIONS)}

        y_cat = [cat_map.get(d["category"], 0) for d in data]
        y_sev = [float(d["severity"]) for d in data]
        y_ent = []
        for d in data:
            ent_vec = [
                1.0 if d["has_bleeding"] else 0.0,
                1.0 if d["is_unconscious"] else 0.0,
                1.0 if d["breathing_distress"] else 0.0,
                1.0 if d["fire_hazard"] in ["contained_flames", "spreading_structure"] else 0.0,
                1.0 if d["is_trapped"] else 0.0,
            ]
            y_ent.append(ent_vec)
        y_act = [act_map.get(d.get("action", "general_inquiry"), 0) for d in data]

        self.vectorizer = TfidfVectorizer(max_features=450, ngram_range=(1, 2), stop_words='english')
        X_vec = self.vectorizer.fit_transform(texts).toarray()

        dataset = TriageDataset(X_vec, y_cat, y_sev, y_ent, y_act)
        loader = DataLoader(dataset, batch_size=32, shuffle=True)

        self.model = TriageMultiTaskDNN(X_vec.shape[1], len(CATEGORIES), len(ACTIONS))
        self.model.train()

        criterion_cat = nn.CrossEntropyLoss()
        criterion_sev = nn.MSELoss()
        criterion_ent = nn.BCEWithLogitsLoss()
        criterion_act = nn.CrossEntropyLoss()

        optimizer = optim.AdamW(self.model.parameters(), lr=0.003, weight_decay=1e-4)

        for epoch in range(12):
            for X_b, cat_b, sev_b, ent_b, act_b in loader:
                optimizer.zero_grad()
                pred_cat, pred_sev, pred_ent, pred_act = self.model(X_b)
                loss_c = criterion_cat(pred_cat, cat_b)
                loss_s = criterion_sev(pred_sev, sev_b)
                loss_e = criterion_ent(pred_ent, ent_b)
                loss_a = criterion_act(pred_act, act_b)
                total_loss = loss_c + 0.3 * loss_s + 0.5 * loss_e + 0.8 * loss_a
                total_loss.backward()
                optimizer.step()

        self.model.eval()
        with torch.no_grad():
            X_all = torch.tensor(X_vec, dtype=torch.float32)
            cat_logits_all, _, _, _ = self.model(X_all)
            preds_cat = cat_logits_all.argmax(dim=1).numpy()

        acc = accuracy_score(y_cat, preds_cat)
        prec = precision_score(y_cat, preds_cat, average='weighted', zero_division=0)
        rec = recall_score(y_cat, preds_cat, average='weighted', zero_division=0)
        f1 = f1_score(y_cat, preds_cat, average='weighted', zero_division=0)

        # Save artifacts
        with open(VECTORIZER_PATH, "wb") as f:
            pickle.dump(self.vectorizer, f)
        torch.save(self.model.state_dict(), MODEL_WEIGHTS_PATH)
        self.is_trained = True

        return {
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_score": float(f1)
        }

    def predict(self, text: str) -> Dict[str, Any]:
        """Predicts incident type, severity, clinical entities, and next triage question."""
        if not self.is_trained or not self.vectorizer or not self.model:
            self._initialize_or_train()

        vec = self.vectorizer.transform([text]).toarray()
        X_t = torch.tensor(vec, dtype=torch.float32)
        self.model.eval()
        with torch.no_grad():
            cat_logits, sev_val, ent_logits, act_logits = self.model(X_t)
            cat_idx = cat_logits.argmax(dim=1).item()
            predicted_category = CATEGORIES[cat_idx]
            cat_prob = torch.softmax(cat_logits, dim=1)[0, cat_idx].item()

            predicted_severity = int(np.clip(round(sev_val.item()), 1, 5))
            ent_probs = torch.sigmoid(ent_logits)[0].numpy()

            act_idx = act_logits.argmax(dim=1).item()
            predicted_action = ACTIONS[act_idx]

        return {
            "predicted_category": predicted_category,
            "category_confidence": round(cat_prob, 3),
            "predicted_severity": predicted_severity,
            "has_bleeding": bool(ent_probs[0] > 0.45),
            "is_unconscious": bool(ent_probs[1] > 0.45),
            "breathing_distress": bool(ent_probs[2] > 0.45),
            "fire_hazard": bool(ent_probs[3] > 0.45),
            "is_trapped": bool(ent_probs[4] > 0.45),
            "recommended_action": predicted_action,
        }

triage_dnn_predictor = TriageNeuralPredictor()
