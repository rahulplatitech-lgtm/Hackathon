"""
Comprehensive ML & DL Model Evaluation for CrisisSync AI Backend.
Trains and evaluates all Machine Learning & Deep Learning methods used in the platform:
1. Random Forest Classifier (Scikit-Learn Ensemble)
2. XGBoost Classifier (Gradient Boosted Decision Trees)
3. Hybrid Ensemble Model (Random Forest + XGBoost Soft Voting)
4. Deep Neural Network (PyTorch DNN with BatchNorm & Dropout)
5. Multi-Layer Perceptron (Scikit-Learn Deep MLP Neural Network)
6. Federated Learning Model (FedAvg Distributed SGD Aggregation across 4 Nodes)

Computes Accuracy, Precision, Recall, F1 Score, Confusion Matrices, and generates
publication-quality performance evaluation matrix graphs.
"""

import os
import sys
import json
import shutil
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from typing import Dict, Any, List, Tuple
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)

# XGBoost
import xgboost as xgb
from xgboost import XGBClassifier

# PyTorch Deep Learning
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader

# Set random seeds for strict reproducibility
np.random.seed(42)
torch.manual_seed(42)

CLASSES = [
    "Severity 1\n(Low)",
    "Severity 2\n(Minor)",
    "Severity 3\n(Moderate)",
    "Severity 4\n(Severe)",
    "Severity 5\n(Critical)"
]
CLASS_NAMES_SHORT = ["S1 (Low)", "S2 (Minor)", "S3 (Moderate)", "S4 (Severe)", "S5 (Critical)"]


# ---------------------------------------------------------
# 1. Dataset Generation (Aligned with severity_predictor.py)
# ---------------------------------------------------------
def generate_emergency_dataset(n_samples: int = 2500) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate realistic multi-factor emergency incident dataset
    Features:
    0: People affected (1 to 100)
    1: Urgency rating (1 to 5)
    2: Structural fire present (0 or 1)
    3: Building collapse present (0 or 1)
    4: Critical medical casualties present (0 or 1)
    5: Required resource count (1 to 6)
    6: Dispatch response elapsed minutes (0 to 120)
    """
    np.random.seed(42)
    features = []
    labels = []

    for _ in range(n_samples):
        people = np.random.randint(1, 60)
        urgency = np.random.choice([1, 2, 3, 4, 5], p=[0.15, 0.25, 0.30, 0.20, 0.10])
        has_fire = np.random.choice([0, 1], p=[0.75, 0.25])
        has_collapse = np.random.choice([0, 1], p=[0.85, 0.15])
        has_medical = np.random.choice([0, 1], p=[0.55, 0.45])
        resource_count = np.random.randint(1, 6)
        time_elapsed = np.random.uniform(2, 90)

        features.append([people, urgency, has_fire, has_collapse, has_medical, resource_count, time_elapsed])

        # Mathematical emergency severity formulation with realistic stochastic variance
        base_score = (
            (people / 50.0) * 1.8 +
            (urgency / 5.0) * 2.0 +
            (1.1 * has_fire) +
            (1.4 * has_collapse) +
            (0.9 * has_medical) +
            (0.15 * resource_count) +
            np.random.normal(0, 0.22)  # slight real-world noise
        )

        if base_score >= 4.1:
            lbl = 4  # Class index 4 -> Severity 5 (Critical)
        elif base_score >= 3.1:
            lbl = 3  # Class index 3 -> Severity 4 (Severe)
        elif base_score >= 2.1:
            lbl = 2  # Class index 2 -> Severity 3 (Moderate)
        elif base_score >= 1.2:
            lbl = 1  # Class index 1 -> Severity 2 (Minor)
        else:
            lbl = 0  # Class index 0 -> Severity 1 (Low)

        labels.append(lbl)

    return np.array(features, dtype=np.float32), np.array(labels, dtype=np.int64)


# ---------------------------------------------------------
# 2. PyTorch Deep Neural Network Architecture
# ---------------------------------------------------------
class CrisisDeepNeuralNet(nn.Module):
    """Deep Neural Network for Emergency Severity Assessment."""
    def __init__(self, input_dim: int = 7, num_classes: int = 5):
        super(CrisisDeepNeuralNet, self).__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.20),
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes)
        )

    def forward(self, x):
        return self.net(x)


# ---------------------------------------------------------
# 3. Federated Learning Node Simulation
# ---------------------------------------------------------
class SimulatedFederatedSystem:
    """
    Simulates Federated Learning across 4 decentralized emergency dispatch nodes:
    - Node A: Central City Command
    - Node B: South Metropolitan Hub
    - Node C: West Suburban Dispatch
    - Node D: North Industrial Sector
    Uses FedAvg aggregation of SGDClassifier weights.
    """
    def __init__(self, n_classes: int = 5, n_features: int = 7):
        self.n_classes = n_classes
        self.n_features = n_features
        self.classes_ = np.arange(n_classes)
        self.global_coef = np.zeros((n_classes, n_features))
        self.global_intercept = np.zeros(n_classes)

    def train_fedavg(self, X_train: np.ndarray, y_train: np.ndarray, n_nodes: int = 4, rounds: int = 5):
        # Distribute training data across nodes
        node_slices = np.array_split(np.random.permutation(len(X_train)), n_nodes)
        
        for r in range(rounds):
            local_coefs = []
            local_intercepts = []
            local_counts = []

            for i, slice_idx in enumerate(node_slices):
                X_node = X_train[slice_idx]
                y_node = y_train[slice_idx]

                node_clf = SGDClassifier(
                    loss="log_loss",
                    penalty="l2",
                    alpha=0.001,
                    max_iter=30,
                    warm_start=True,
                    random_state=42 + r * 10 + i
                )
                
                # Warm-start with previous global weights if available
                if r > 0:
                    node_clf.classes_ = self.classes_
                    node_clf.coef_ = self.global_coef.copy()
                    node_clf.intercept_ = self.global_intercept.copy()

                node_clf.fit(X_node, y_node)
                local_coefs.append(node_clf.coef_)
                local_intercepts.append(node_clf.intercept_)
                local_counts.append(len(X_node))

            # FedAvg: Weighted average by local dataset size
            total_samples = sum(local_counts)
            avg_coef = np.zeros_like(self.global_coef)
            avg_intercept = np.zeros_like(self.global_intercept)

            for coef, intercept, count in zip(local_coefs, local_intercepts, local_counts):
                weight = count / total_samples
                avg_coef += weight * coef
                avg_intercept += weight * intercept

            self.global_coef = avg_coef
            self.global_intercept = avg_intercept

    def predict(self, X: np.ndarray) -> np.ndarray:
        # Compute logits = X @ W.T + b
        scores = np.dot(X, self.global_coef.T) + self.global_intercept
        return np.argmax(scores, axis=1)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        scores = np.dot(X, self.global_coef.T) + self.global_intercept
        exp_scores = np.exp(scores - np.max(scores, axis=1, keepdims=True))
        return exp_scores / np.sum(exp_scores, axis=1, keepdims=True)


# ---------------------------------------------------------
# 4. Main Training and Evaluation Pipeline
# ---------------------------------------------------------
def run_evaluation():
    print("=" * 80)
    print(" CrisisSync AI Backend: Comprehensive ML & DL Evaluation ")
    print("=" * 80)

    # Output directory
    output_dir = "/Users/rahul/Documents/Hackathon/crisis-command-ai/Deployment-ready-code/backend/reports"
    artifacts_dir = "/Users/rahul/.gemini/antigravity/brain/1fb0548b-1cce-462d-b707-6936a7bc289f"
    os.makedirs(output_dir, exist_ok=True)

    # 1. Dataset Generation
    print("\n[1/6] Generating synthetic emergency dataset (2,500 samples, 7 emergency features)...")
    X, y = generate_emergency_dataset(n_samples=2500)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # Normalize features for DL & Linear models
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print(f"      - Training samples: {len(X_train)} | Test samples: {len(X_test)}")
    for i, cname in enumerate(CLASS_NAMES_SHORT):
        count_train = np.sum(y_train == i)
        count_test = np.sum(y_test == i)
        print(f"      - Class {cname}: Train={count_train}, Test={count_test}")

    models_predictions: Dict[str, np.ndarray] = {}
    models_probas: Dict[str, np.ndarray] = {}
    metrics_summary: List[Dict[str, Any]] = []

    # ---------------------------------------------------------
    # Model 1: Random Forest Classifier (app/ml/severity_predictor.py)
    # ---------------------------------------------------------
    print("\n[2/6] Training Model 1: Random Forest Classifier (Scikit-Learn)...")
    rf_model = RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    rf_pred = rf_model.predict(X_test)
    rf_proba = rf_model.predict_proba(X_test)
    models_predictions["Random Forest"] = rf_pred
    models_probas["Random Forest"] = rf_proba

    # ---------------------------------------------------------
    # Model 2: XGBoost Classifier (app/ml/severity_predictor.py)
    # ---------------------------------------------------------
    print("\n[3/6] Training Model 2: XGBoost Classifier (Gradient Boosted Trees)...")
    xgb_model = XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.08,
        objective="multi:softprob",
        num_class=5,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        eval_metric="mlogloss",
        verbosity=0
    )
    xgb_model.fit(X_train, y_train)
    xgb_pred = xgb_model.predict(X_test)
    xgb_proba = xgb_model.predict_proba(X_test)
    models_predictions["XGBoost"] = xgb_pred
    models_probas["XGBoost"] = xgb_proba

    # ---------------------------------------------------------
    # Model 3: Hybrid Ensemble (RF + XGBoost Weighted Soft Voting)
    # ---------------------------------------------------------
    print("\n[4/6] Evaluating Model 3: Hybrid Ensemble (Random Forest + XGBoost)...")
    ensemble_proba = 0.50 * rf_proba + 0.50 * xgb_proba
    ensemble_pred = np.argmax(ensemble_proba, axis=1)
    models_predictions["Ensemble (RF + XGB)"] = ensemble_pred
    models_probas["Ensemble (RF + XGB)"] = ensemble_proba

    # ---------------------------------------------------------
    # Model 4: Deep Learning PyTorch Neural Network (DNN)
    # ---------------------------------------------------------
    print("\n[5/6] Training Model 4: Deep Neural Network (PyTorch 3-Layer DNN)...")
    torch_device = torch.device("cpu")
    train_dataset = TensorDataset(
        torch.tensor(X_train_scaled, dtype=torch.float32),
        torch.tensor(y_train, dtype=torch.long)
    )
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)

    dnn = CrisisDeepNeuralNet(input_dim=7, num_classes=5).to(torch_device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(dnn.parameters(), lr=0.005, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=15, gamma=0.5)

    dnn.train()
    epochs = 40
    for epoch in range(epochs):
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(torch_device), batch_y.to(torch_device)
            optimizer.zero_grad()
            out = dnn(batch_x)
            loss = criterion(out, batch_y)
            loss.backward()
            optimizer.step()
        scheduler.step()

    dnn.eval()
    with torch.no_grad():
        test_x_tensor = torch.tensor(X_test_scaled, dtype=torch.float32).to(torch_device)
        logits = dnn(test_x_tensor)
        dnn_proba = torch.softmax(logits, dim=1).cpu().numpy()
        dnn_pred = np.argmax(dnn_proba, axis=1)
    models_predictions["PyTorch Deep Neural Net"] = dnn_pred
    models_probas["PyTorch Deep Neural Net"] = dnn_proba

    # ---------------------------------------------------------
    # Model 5: Multi-Layer Perceptron (Deep ANN from Scikit-Learn)
    # ---------------------------------------------------------
    print("\n[6/6] Training Model 5 & 6: MLP Neural Network & Federated SGD...")
    mlp_model = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation="relu",
        solver="adam",
        alpha=0.0005,
        batch_size=32,
        learning_rate_init=0.003,
        max_iter=150,
        random_state=42,
        early_stopping=True
    )
    mlp_model.fit(X_train_scaled, y_train)
    mlp_pred = mlp_model.predict(X_test_scaled)
    mlp_proba = mlp_model.predict_proba(X_test_scaled)
    models_predictions["MLP Neural Network"] = mlp_pred
    models_probas["MLP Neural Network"] = mlp_proba

    # ---------------------------------------------------------
    # Model 6: Federated Learning (FedAvg SGD Classifier - app/ml/federated.py)
    # ---------------------------------------------------------
    fed_system = SimulatedFederatedSystem(n_classes=5, n_features=7)
    fed_system.train_fedavg(X_train_scaled, y_train, n_nodes=4, rounds=6)
    fed_pred = fed_system.predict(X_test_scaled)
    fed_proba = fed_system.predict_proba(X_test_scaled)
    models_predictions["Federated Learning (FedAvg)"] = fed_pred
    models_probas["Federated Learning (FedAvg)"] = fed_proba

    # ---------------------------------------------------------
    # 5. Compute Metrics for All Models
    # ---------------------------------------------------------
    print("\n" + "=" * 80)
    print(f"{'Model Name':<30} | {'Accuracy':<10} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}")
    print("-" * 80)

    for name, pred in models_predictions.items():
        acc = accuracy_score(y_test, pred)
        prec_w = precision_score(y_test, pred, average="weighted", zero_division=0)
        rec_w = recall_score(y_test, pred, average="weighted", zero_division=0)
        f1_w = f1_score(y_test, pred, average="weighted", zero_division=0)

        prec_macro = precision_score(y_test, pred, average="macro", zero_division=0)
        rec_macro = recall_score(y_test, pred, average="macro", zero_division=0)
        f1_macro = f1_score(y_test, pred, average="macro", zero_division=0)

        cm = confusion_matrix(y_test, pred)

        metrics_summary.append({
            "model": name,
            "accuracy": float(acc),
            "precision_weighted": float(prec_w),
            "recall_weighted": float(rec_w),
            "f1_weighted": float(f1_w),
            "precision_macro": float(prec_macro),
            "recall_macro": float(rec_macro),
            "f1_macro": float(f1_macro),
            "confusion_matrix": cm.tolist()
        })

        print(f"{name:<30} | {acc * 100:>8.2f}% | {prec_w * 100:>8.2f}% | {rec_w * 100:>8.2f}% | {f1_w * 100:>8.2f}%")

    print("=" * 80)

    # Save metrics JSON
    json_path = os.path.join(output_dir, "evaluation_metrics.json")
    with open(json_path, "w") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"\n[Saved JSON] Metrics saved to {json_path}")

    # ---------------------------------------------------------
    # 6. Plot 1: Performance Evaluation Matrix Graph
    # ---------------------------------------------------------
    print("\nGenerating Performance Evaluation Matrix Graph...")
    model_names = [m["model"] for m in metrics_summary]
    accs = [m["accuracy"] * 100 for m in metrics_summary]
    precs = [m["precision_weighted"] * 100 for m in metrics_summary]
    recs = [m["recall_weighted"] * 100 for m in metrics_summary]
    f1s = [m["f1_weighted"] * 100 for m in metrics_summary]

    x = np.arange(len(model_names))
    width = 0.20

    plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
    fig, ax = plt.subplots(figsize=(14, 7), dpi=300)

    rects1 = ax.bar(x - 1.5 * width, accs, width, label='Accuracy', color='#2563EB', edgecolor='black', linewidth=0.5)
    rects2 = ax.bar(x - 0.5 * width, precs, width, label='Precision (Weighted)', color='#10B981', edgecolor='black', linewidth=0.5)
    rects3 = ax.bar(x + 0.5 * width, recs, width, label='Recall (Weighted)', color='#F59E0B', edgecolor='black', linewidth=0.5)
    rects4 = ax.bar(x + 1.5 * width, f1s, width, label='F1-Score (Weighted)', color='#8B5CF6', edgecolor='black', linewidth=0.5)

    ax.set_ylabel('Score (%)', fontsize=13, fontweight='bold', labelpad=10)
    ax.set_title('CrisisSync AI Backend - ML & DL Performance Evaluation Matrix\nComparative Benchmark Across All Platform Models', fontsize=15, fontweight='bold', pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(model_names, fontsize=11, fontweight='semibold', rotation=12, ha='right')
    ax.legend(loc='lower right', frameon=True, facecolor='white', framealpha=0.95, fontsize=11)
    ax.set_ylim(60, 105)

    # Attach labels above bars
    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f'{height:.1f}%',
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3),  # 3 points vertical offset
                        textcoords="offset points",
                        ha='center', va='bottom', fontsize=8, fontweight='bold', rotation=45)

    autolabel(rects1)
    autolabel(rects2)
    autolabel(rects3)
    autolabel(rects4)

    plt.tight_layout()
    perf_graph_path = os.path.join(output_dir, "performance_evaluation_matrix.png")
    plt.savefig(perf_graph_path, dpi=300)
    plt.close()
    print(f"      - Saved: {perf_graph_path}")

    # ---------------------------------------------------------
    # 7. Plot 2: Combined 6-Panel Confusion Matrix
    # ---------------------------------------------------------
    print("\nGenerating Combined Confusion Matrix Figure...")
    fig, axes = plt.subplots(2, 3, figsize=(18, 12), dpi=300)
    axes = axes.flatten()

    colormaps = ["Blues", "Greens", "Purples", "Reds", "YlOrRd", "PuBuGn"]

    for idx, (m_info, ax, cmap) in enumerate(zip(metrics_summary, axes, colormaps)):
        cm = np.array(m_info["confusion_matrix"])
        sns.heatmap(
            cm,
            annot=True,
            fmt="d",
            cmap=cmap,
            cbar=True,
            ax=ax,
            xticklabels=["S1", "S2", "S3", "S4", "S5"],
            yticklabels=["S1", "S2", "S3", "S4", "S5"],
            linewidths=0.6,
            linecolor="gray"
        )
        ax.set_title(f"{m_info['model']}\nAccuracy: {m_info['accuracy']*100:.2f}% | F1: {m_info['f1_weighted']*100:.2f}%",
                     fontsize=12, fontweight='bold', pad=8)
        ax.set_xlabel("Predicted Severity Class", fontsize=10, fontweight='semibold')
        ax.set_ylabel("True Severity Class", fontsize=10, fontweight='semibold')

    plt.suptitle("CrisisSync AI: Confusion Matrices for All ML & DL Backend Methods\nEmergency Severity Classification (Scale 1: Low to 5: Critical)",
                 fontsize=16, fontweight='bold', y=0.98)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    cm_all_path = os.path.join(output_dir, "confusion_matrix_all_methods.png")
    plt.savefig(cm_all_path, dpi=300)
    plt.close()
    print(f"      - Saved: {cm_all_path}")

    # ---------------------------------------------------------
    # 8. Individual Confusion Matrix Plots for Each Method
    # ---------------------------------------------------------
    print("\nGenerating Individual Confusion Matrix Plots for Each Model...")
    filename_slugs = {
        "Random Forest": "confusion_matrix_random_forest.png",
        "XGBoost": "confusion_matrix_xgboost.png",
        "Ensemble (RF + XGB)": "confusion_matrix_ensemble.png",
        "PyTorch Deep Neural Net": "confusion_matrix_pytorch_dnn.png",
        "MLP Neural Network": "confusion_matrix_mlp_neural_network.png",
        "Federated Learning (FedAvg)": "confusion_matrix_federated_sgd.png",
    }

    palette_map = {
        "Random Forest": "Blues",
        "XGBoost": "Greens",
        "Ensemble (RF + XGB)": "Purples",
        "PyTorch Deep Neural Net": "Reds",
        "MLP Neural Network": "YlOrRd",
        "Federated Learning (FedAvg)": "PuBuGn",
    }

    for m_info in metrics_summary:
        name = m_info["model"]
        fname = filename_slugs.get(name, f"cm_{name.lower().replace(' ', '_')}.png")
        fpath = os.path.join(output_dir, fname)

        cm = np.array(m_info["confusion_matrix"])
        # Also compute percentage normalized matrix
        row_sums = cm.sum(axis=1)[:, np.newaxis]
        cm_norm = np.divide(cm.astype('float'), row_sums, out=np.zeros_like(cm, dtype=float), where=row_sums != 0)

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6), dpi=300)

        labels_display = ["S1 (Low)", "S2 (Minor)", "S3 (Moderate)", "S4 (Severe)", "S5 (Critical)"]

        # Raw counts
        sns.heatmap(
            cm,
            annot=True,
            fmt="d",
            cmap=palette_map.get(name, "Blues"),
            cbar=True,
            ax=ax1,
            xticklabels=labels_display,
            yticklabels=labels_display,
            linewidths=0.6,
            linecolor="white",
            annot_kws={"size": 11, "weight": "bold"}
        )
        ax1.set_title(f"Raw Incident Counts\n{name}", fontsize=13, fontweight='bold', pad=10)
        ax1.set_xlabel("Predicted Severity Class", fontsize=11, fontweight='semibold', labelpad=8)
        ax1.set_ylabel("True Ground-Truth Severity", fontsize=11, fontweight='semibold', labelpad=8)
        ax1.tick_params(axis='y', rotation=0, labelsize=10)
        ax1.tick_params(axis='x', rotation=20, labelsize=10)

        # Normalized percentages
        sns.heatmap(
            cm_norm * 100,
            annot=True,
            fmt=".1f",
            cmap=palette_map.get(name, "Blues"),
            cbar=True,
            ax=ax2,
            xticklabels=labels_display,
            yticklabels=labels_display,
            linewidths=0.6,
            linecolor="white",
            annot_kws={"size": 11, "weight": "bold"}
        )
        ax2.set_title(f"Normalized Class Recall (%)\nAccuracy: {m_info['accuracy']*100:.2f}% | F1: {m_info['f1_weighted']*100:.2f}%", fontsize=13, fontweight='bold', pad=10)
        ax2.set_xlabel("Predicted Severity Class", fontsize=11, fontweight='semibold', labelpad=8)
        ax2.set_ylabel("True Ground-Truth Severity", fontsize=11, fontweight='semibold', labelpad=8)
        ax2.tick_params(axis='y', rotation=0, labelsize=10)
        ax2.tick_params(axis='x', rotation=20, labelsize=10)

        plt.suptitle(f"Emergency Severity Confusion Matrix: {name}\nEvaluation on 500 Stratified Holdout Incidents (Macro F1: {m_info['f1_macro']*100:.2f}%)",
                     fontsize=15, fontweight='bold', y=0.98)
        plt.tight_layout(rect=[0, 0.03, 1, 0.94])
        plt.savefig(fpath, dpi=300)
        plt.close()
        print(f"      - Saved: {fpath}")

    # Copy files to artifacts directory so user can see them in chat UI
    if os.path.exists(artifacts_dir):
        print(f"\nCopying plots to artifacts directory ({artifacts_dir})...")
        for f in os.listdir(output_dir):
            if f.endswith(".png") or f.endswith(".json"):
                shutil.copy(os.path.join(output_dir, f), os.path.join(artifacts_dir, f))
        print("      - All artifacts copied successfully.")

    print("\n" + "=" * 80)
    print(" ALL ML & DL EVALUATION CALCULATIONS AND GRAPHS COMPLETED ")
    print("=" * 80)


if __name__ == "__main__":
    run_evaluation()
