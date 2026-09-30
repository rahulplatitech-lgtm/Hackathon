"""Federated Learning simulation with FedAvg and SGD aggregation.
Simulates privacy-preserving model training across multiple nodes."""
import numpy as np
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

try:
    from sklearn.linear_model import SGDClassifier
    from sklearn.preprocessing import StandardScaler
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

class FederatedNode:
    """Represents a single node in the federated learning setup."""
    def __init__(self, node_id: str, data_size: int = 100):
        self.node_id = node_id
        self.data_size = data_size
        self.model_weights: Optional[np.ndarray] = None

    def local_train(self, X: np.ndarray, y: np.ndarray, epochs: int = 5) -> np.ndarray:
        """Train locally and return model weights."""
        if not HAS_SKLEARN:
            return np.random.randn(X.shape[1])

        model = SGDClassifier(loss="log_loss", max_iter=epochs, warm_start=True, random_state=42)
        model.fit(X, y)
        self.model_weights = model.coef_.flatten()
        return self.model_weights


class FederatedLearningManager:
    """Manages federated learning across multiple nodes."""

    def __init__(self, n_nodes: int = 3):
        self.nodes = [FederatedNode(f"node_{i}", data_size=100 + i * 50)
                      for i in range(n_nodes)]
        self.global_weights: Optional[np.ndarray] = None
        self.round_history: List[Dict[str, Any]] = []

    def fed_avg(self, weight_list: List[np.ndarray], data_sizes: List[int]) -> np.ndarray:
        """Federated Averaging (FedAvg) aggregation.
        Weighted average of model parameters proportional to local data size."""
        total = sum(data_sizes)
        weighted = sum(w * (n / total) for w, n in zip(weight_list, data_sizes))
        return weighted

    def fed_sgd(self, gradient_list: List[np.ndarray], learning_rate: float = 0.01) -> np.ndarray:
        """Federated SGD aggregation.
        Average gradients and apply single SGD step."""
        avg_gradient = np.mean(gradient_list, axis=0)
        if self.global_weights is None:
            self.global_weights = np.zeros_like(avg_gradient)
        self.global_weights -= learning_rate * avg_gradient
        return self.global_weights

    def run_round(self, method: str = "fedavg") -> Dict[str, Any]:
        """Run one round of federated learning with synthetic data."""
        np.random.seed(len(self.round_history))
        n_features = 7

        all_weights = []
        data_sizes = []

        for node in self.nodes:
            # Generate synthetic local data
            X = np.random.randn(node.data_size, n_features)
            y = (X[:, 0] + X[:, 1] > 0).astype(int)
            weights = node.local_train(X, y)
            all_weights.append(weights)
            data_sizes.append(node.data_size)

        if method == "fedavg":
            self.global_weights = self.fed_avg(all_weights, data_sizes)
        elif method == "sgd":
            self.global_weights = self.fed_sgd(all_weights)

        round_info = {
            "round": len(self.round_history) + 1,
            "method": method,
            "n_nodes": len(self.nodes),
            "global_weights_norm": float(np.linalg.norm(self.global_weights)),
            "convergence_metric": float(np.std([np.linalg.norm(w) for w in all_weights])),
        }
        self.round_history.append(round_info)
        logger.info(f"Federated learning round {round_info['round']} complete ({method})")
        return round_info

    def get_status(self) -> Dict[str, Any]:
        return {
            "n_nodes": len(self.nodes),
            "rounds_completed": len(self.round_history),
            "last_round": self.round_history[-1] if self.round_history else None,
            "global_weights_set": self.global_weights is not None,
        }

federated_manager = FederatedLearningManager()
