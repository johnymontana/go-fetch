"""Logging configuration for graph algorithms service."""

import sys
from typing import Optional
from loguru import logger


def setup_logger(
    level: str = "INFO",
    format_type: str = "json",
    log_file: Optional[str] = None
) -> None:
    """Setup loguru logger with specified configuration.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format_type: Format type (json or text)
        log_file: Optional log file path
    """
    # Remove default handler
    logger.remove()
    
    # Define formats
    if format_type == "json":
        log_format = (
            '{"time": "{time:YYYY-MM-DD HH:mm:ss.SSS}", '
            '"level": "{level}", '
            '"module": "{module}", '
            '"function": "{function}", '
            '"line": {line}, '
            '"message": "{message}"}'
        )
    else:  # text format
        log_format = (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        )
    
    # Add console handler
    logger.add(
        sys.stdout,
        format=log_format,
        level=level,
        colorize=format_type == "text",
        serialize=format_type == "json"
    )
    
    # Add file handler if specified
    if log_file:
        logger.add(
            log_file,
            format=log_format,
            level=level,
            rotation="10 MB",
            retention="1 week",
            serialize=format_type == "json"
        )