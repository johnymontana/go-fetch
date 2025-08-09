"""Periodic runner for graph algorithms using APScheduler."""

import signal
import sys
from typing import Optional
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from ..core.config import Config
from ..core.dgraph_client import DgraphClient
from ..algorithms.graph_builder import GraphBuilder
from ..algorithms.centrality import CentralityAlgorithms
from ..algorithms.community import CommunityDetection


class PeriodicRunner:
    """Periodic runner for graph algorithms."""
    
    def __init__(self, config: Config):
        """Initialize periodic runner.
        
        Args:
            config: Configuration object
        """
        self.config = config
        self.scheduler = BlockingScheduler(timezone=config.scheduler_timezone)
        self.dgraph_client = None
        self.graph_builder = GraphBuilder()
        self.centrality_algorithms = CentralityAlgorithms(config)
        self.community_algorithms = CommunityDetection(config)
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down scheduler...")
        self.shutdown()
        sys.exit(0)
    
    def _connect_dgraph(self) -> DgraphClient:
        """Connect to Dgraph if not already connected."""
        if not self.dgraph_client:
            self.dgraph_client = DgraphClient(
                self.config.dgraph_connection_string,
                self.config.dgraph_timeout
            )
            logger.info("Connected to Dgraph for periodic runner")
        return self.dgraph_client
    
    def _build_graph(self, entity_type: str = "Entity", limit: int = None):
        """Build graph from Dgraph data."""
        limit = limit or self.config.max_graph_size
        client = self._connect_dgraph()
        
        nodes, edges = client.get_graph_data(entity_type, limit)
        graph = self.graph_builder.build_graph(nodes, edges)
        
        logger.info(f"Built graph with {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges")
        return graph
    
    def run_centrality_algorithms(self):
        """Run centrality algorithms job."""
        try:
            logger.info("Starting scheduled centrality algorithms")
            
            graph = self._build_graph()
            if graph.number_of_nodes() == 0:
                logger.warning("Empty graph, skipping centrality algorithms")
                return
            
            client = self._connect_dgraph()
            results = self.centrality_algorithms.run_all(
                graph,
                write_to_dgraph=True,
                dgraph_client=client
            )
            
            total_results = sum(len(result.get("results", {})) for result in results.values())
            logger.info(f"Completed scheduled centrality algorithms: {total_results} total results")
            
        except Exception as e:
            logger.error(f"Scheduled centrality algorithms failed: {e}")
    
    def run_community_algorithms(self):
        """Run community detection algorithms job."""
        try:
            logger.info("Starting scheduled community detection algorithms")
            
            graph = self._build_graph()
            if graph.number_of_nodes() == 0:
                logger.warning("Empty graph, skipping community detection")
                return
            
            client = self._connect_dgraph()
            results = self.community_algorithms.run_all(
                graph,
                write_to_dgraph=True,
                dgraph_client=client
            )
            
            total_results = sum(len(result.get("results", {})) for result in results.values())
            logger.info(f"Completed scheduled community detection: {total_results} total results")
            
            # Log community analysis
            for alg_name, result in results.items():
                if result.get("results"):
                    analysis = self.community_algorithms.analyze_communities(graph, result["results"])
                    logger.info(f"{alg_name} community analysis: {analysis.get('num_communities', 0)} communities")
            
        except Exception as e:
            logger.error(f"Scheduled community detection failed: {e}")
    
    def run_all_algorithms(self):
        """Run all algorithms job."""
        try:
            logger.info("Starting scheduled execution of all algorithms")
            
            graph = self._build_graph()
            if graph.number_of_nodes() == 0:
                logger.warning("Empty graph, skipping all algorithms")
                return
            
            client = self._connect_dgraph()
            
            # Run centrality algorithms
            centrality_results = self.centrality_algorithms.run_all(
                graph,
                write_to_dgraph=True,
                dgraph_client=client
            )
            
            # Run community detection algorithms
            community_results = self.community_algorithms.run_all(
                graph,
                write_to_dgraph=True,
                dgraph_client=client
            )
            
            # Log summary
            centrality_count = sum(len(result.get("results", {})) for result in centrality_results.values())
            community_count = sum(len(result.get("results", {})) for result in community_results.values())
            
            logger.info(
                f"Completed scheduled execution: {centrality_count} centrality results, "
                f"{community_count} community results"
            )
            
        except Exception as e:
            logger.error(f"Scheduled algorithm execution failed: {e}")
    
    def add_job(self, cron_schedule: str, algorithm_type: str = "all"):
        """Add a scheduled job.
        
        Args:
            cron_schedule: Cron expression (e.g., "0 */6 * * *")
            algorithm_type: Type of algorithms to run (all|centrality|community)
        """
        try:
            trigger = CronTrigger.from_crontab(cron_schedule, timezone=self.config.scheduler_timezone)
            
            if algorithm_type == "centrality":
                job_func = self.run_centrality_algorithms
                job_id = "centrality_job"
                job_name = "Centrality Algorithms"
            elif algorithm_type == "community":
                job_func = self.run_community_algorithms
                job_id = "community_job"
                job_name = "Community Detection"
            else:  # all
                job_func = self.run_all_algorithms
                job_id = "all_algorithms_job"
                job_name = "All Algorithms"
            
            self.scheduler.add_job(
                job_func,
                trigger=trigger,
                id=job_id,
                name=job_name,
                replace_existing=True,
                max_instances=1  # Prevent overlapping runs
            )
            
            logger.info(f"Added job '{job_name}' with schedule: {cron_schedule}")
            
        except Exception as e:
            logger.error(f"Failed to add job: {e}")
            raise
    
    def start_scheduler(self, cron_schedule: str, algorithm_type: str = "all"):
        """Start the scheduler with a job.
        
        Args:
            cron_schedule: Cron expression
            algorithm_type: Type of algorithms to run
        """
        try:
            # Add the job
            self.add_job(cron_schedule, algorithm_type)
            
            logger.info("Starting scheduler...")
            self.scheduler.start()
            
        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")
            raise
    
    def start_scheduler_daemon(self):
        """Start scheduler in daemon mode (non-blocking)."""
        from apscheduler.schedulers.background import BackgroundScheduler
        
        # Replace with background scheduler
        self.scheduler = BackgroundScheduler(timezone=self.config.scheduler_timezone)
        
        logger.info("Starting scheduler in daemon mode...")
        self.scheduler.start()
    
    def run_once(self, algorithm_type: str = "all"):
        """Run algorithms once (for testing).
        
        Args:
            algorithm_type: Type of algorithms to run
        """
        try:
            logger.info(f"Running {algorithm_type} algorithms once")
            
            if algorithm_type == "centrality":
                self.run_centrality_algorithms()
            elif algorithm_type == "community":
                self.run_community_algorithms()
            else:
                self.run_all_algorithms()
                
            logger.info("One-time run completed")
            
        except Exception as e:
            logger.error(f"One-time run failed: {e}")
            raise
    
    def list_jobs(self):
        """List all scheduled jobs."""
        jobs = self.scheduler.get_jobs()
        if not jobs:
            logger.info("No jobs scheduled")
            return
        
        logger.info(f"Scheduled jobs ({len(jobs)}):")
        for job in jobs:
            logger.info(f"  {job.id}: {job.name} - Next run: {job.next_run_time}")
    
    def shutdown(self):
        """Shutdown the scheduler."""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown(wait=False)
                logger.info("Scheduler shut down")
            
            if self.dgraph_client:
                self.dgraph_client.close()
                logger.info("Dgraph connection closed")
                
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
    
    def get_status(self) -> dict:
        """Get scheduler status.
        
        Returns:
            Dictionary with scheduler status
        """
        return {
            "running": self.scheduler.running if hasattr(self.scheduler, 'running') else False,
            "num_jobs": len(self.scheduler.get_jobs()),
            "timezone": str(self.scheduler.timezone),
            "dgraph_connected": self.dgraph_client is not None
        }