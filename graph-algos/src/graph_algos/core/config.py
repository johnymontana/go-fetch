"""Configuration management for graph algorithms service."""

import os
from typing import Optional, Dict, Any
from pydantic import Field, validator
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """Application configuration using Pydantic settings."""
    
    # Dgraph Configuration
    dgraph_connection_string: str = Field(
        default="dgraph://localhost:9080",
        description="Dgraph connection string"
    )
    dgraph_timeout: int = Field(
        default=30,
        description="Dgraph query timeout in seconds"
    )
    
    # Flask Server Configuration
    flask_host: str = Field(default="0.0.0.0", description="Flask server host")
    flask_port: int = Field(default=5000, description="Flask server port")
    flask_debug: bool = Field(default=False, description="Flask debug mode")
    
    # Logging Configuration
    log_level: str = Field(default="INFO", description="Log level")
    log_format: str = Field(default="json", description="Log format (json|text)")
    
    # Algorithm Configuration
    default_algorithm_timeout: int = Field(
        default=300,
        description="Default timeout for algorithms in seconds"
    )
    max_graph_size: int = Field(
        default=100000,
        description="Maximum number of nodes to process"
    )
    enable_caching: bool = Field(
        default=True,
        description="Enable result caching"
    )
    
    # Scheduler Configuration
    enable_scheduler: bool = Field(
        default=True,
        description="Enable periodic scheduler"
    )
    scheduler_timezone: str = Field(
        default="UTC",
        description="Scheduler timezone"
    )
    
    # Algorithm Toggles
    enable_louvain: bool = Field(default=True, description="Enable Louvain algorithm")
    enable_label_propagation: bool = Field(
        default=True,
        description="Enable Label Propagation algorithm"
    )
    enable_leiden: bool = Field(default=True, description="Enable Leiden algorithm")
    enable_pagerank: bool = Field(default=True, description="Enable PageRank algorithm")
    enable_betweenness: bool = Field(
        default=True,
        description="Enable Betweenness Centrality"
    )
    enable_closeness: bool = Field(
        default=True,
        description="Enable Closeness Centrality"
    )
    enable_eigenvector: bool = Field(
        default=True,
        description="Enable Eigenvector Centrality"
    )
    
    # Performance Settings
    batch_size: int = Field(default=1000, description="Batch size for processing")
    parallel_processing: bool = Field(
        default=True,
        description="Enable parallel processing"
    )
    max_workers: int = Field(default=4, description="Maximum number of worker threads")
    
    @validator("log_level")
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of {valid_levels}")
        return v.upper()
    
    @validator("log_format")
    def validate_log_format(cls, v: str) -> str:
        """Validate log format."""
        valid_formats = {"json", "text"}
        if v.lower() not in valid_formats:
            raise ValueError(f"Log format must be one of {valid_formats}")
        return v.lower()
    
    @validator("dgraph_connection_string")
    def validate_dgraph_connection(cls, v: str) -> str:
        """Validate Dgraph connection string."""
        if not v.startswith("dgraph://"):
            raise ValueError("Dgraph connection string must start with 'dgraph://'")
        return v
    
    def get_enabled_algorithms(self) -> Dict[str, bool]:
        """Get dictionary of enabled algorithms."""
        return {
            "louvain": self.enable_louvain,
            "label_propagation": self.enable_label_propagation,
            "leiden": self.enable_leiden,
            "pagerank": self.enable_pagerank,
            "betweenness": self.enable_betweenness,
            "closeness": self.enable_closeness,
            "eigenvector": self.enable_eigenvector,
        }
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False