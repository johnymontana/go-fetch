#!/usr/bin/env python3
"""
Example: Using the Graph Algorithms REST API.

This example demonstrates how to:
1. Make requests to the Flask API server
2. Run algorithms via HTTP
3. Process JSON responses
4. Handle errors gracefully
"""

import requests
import json
import time
from typing import Dict, Any


class GraphAlgoClient:
    """Client for Graph Algorithms REST API."""
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        """Initialize client.
        
        Args:
            base_url: Base URL of the API server
        """
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
    
    def health_check(self) -> Dict[str, Any]:
        """Check API server health."""
        response = self.session.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
    def list_algorithms(self) -> Dict[str, Any]:
        """List available algorithms."""
        response = self.session.get(f"{self.base_url}/algorithms")
        response.raise_for_status()
        return response.json()
    
    def get_graph_info(self, **params) -> Dict[str, Any]:
        """Get graph information."""
        if params:
            response = self.session.post(f"{self.base_url}/graph/info", json=params)
        else:
            response = self.session.get(f"{self.base_url}/graph/info")
        response.raise_for_status()
        return response.json()
    
    def run_centrality(
        self,
        algorithm: str = "all",
        parameters: Dict[str, Any] = None,
        write_to_dgraph: bool = True,
        **graph_params
    ) -> Dict[str, Any]:
        """Run centrality algorithms."""
        payload = {
            "algorithm": algorithm,
            "parameters": parameters or {},
            "write_to_dgraph": write_to_dgraph,
            "graph_parameters": graph_params
        }
        
        response = self.session.post(f"{self.base_url}/centrality/run", json=payload)
        response.raise_for_status()
        return response.json()
    
    def run_community(
        self,
        algorithm: str = "all",
        parameters: Dict[str, Any] = None,
        analyze_communities: bool = True,
        write_to_dgraph: bool = True,
        **graph_params
    ) -> Dict[str, Any]:
        """Run community detection algorithms."""
        payload = {
            "algorithm": algorithm,
            "parameters": parameters or {},
            "analyze_communities": analyze_communities,
            "write_to_dgraph": write_to_dgraph,
            "graph_parameters": graph_params
        }
        
        response = self.session.post(f"{self.base_url}/community/run", json=payload)
        response.raise_for_status()
        return response.json()
    
    def run_all_algorithms(
        self,
        parameters: Dict[str, Any] = None,
        write_to_dgraph: bool = True,
        **graph_params
    ) -> Dict[str, Any]:
        """Run all available algorithms."""
        payload = {
            "parameters": parameters or {},
            "write_to_dgraph": write_to_dgraph,
            "graph_parameters": graph_params
        }
        
        response = self.session.post(f"{self.base_url}/algorithms/run", json=payload)
        response.raise_for_status()
        return response.json()


def print_results_summary(results: Dict[str, Any], algorithm_type: str):
    """Print a summary of algorithm results."""
    print(f"\n📊 {algorithm_type.title()} Results Summary:")
    print("-" * 50)
    
    for alg_name, result in results.items():
        if "metadata" in result:
            metadata = result["metadata"]
            duration = metadata.get("duration_seconds", 0)
            count = metadata.get("result_count", 0)
            error = metadata.get("error")
            
            if error:
                print(f"❌ {alg_name}: Failed - {error}")
            else:
                print(f"✅ {alg_name}: {count} results in {duration:.2f}s")
                
                # Show community analysis if available
                if "analysis" in result:
                    analysis = result["analysis"]
                    num_communities = analysis.get("num_communities", 0)
                    modularity = analysis.get("modularity")
                    print(f"   🏘️  Communities: {num_communities}")
                    if modularity:
                        print(f"   📊 Modularity: {modularity:.4f}")


def main():
    """Run API client example."""
    print("🌐 Graph Algorithms API Client Example")
    print("=" * 60)
    
    # Initialize client
    client = GraphAlgoClient("http://localhost:5000")
    
    try:
        # Health check
        print("🏥 Checking API health...")
        health = client.health_check()
        print(f"✅ API Status: {health['status']}")
        print(f"📡 Dgraph: {health['dgraph']}")
        
        # List algorithms
        print("\n📋 Available algorithms...")
        algorithms = client.list_algorithms()
        
        centrality_algs = algorithms["centrality"]["algorithms"]
        community_algs = algorithms["community"]["algorithms"]
        
        print(f"🎯 Centrality: {', '.join(centrality_algs)}")
        print(f"🏘️  Community: {', '.join(community_algs)}")
        
        # Get graph info
        print("\n📊 Getting graph information...")
        graph_info = client.get_graph_info(limit=5000)
        
        print(f"📈 Graph size: {graph_info['nodes']} nodes, {graph_info['edges']} edges")
        print(f"🔗 Density: {graph_info['density']:.6f}")
        print(f"🌐 Connected: {graph_info['is_connected']}")
        
        if graph_info['nodes'] == 0:
            print("❌ Empty graph - no algorithms can be run")
            return
        
        # Run PageRank
        print("\n🎯 Running PageRank algorithm...")
        start_time = time.time()
        
        pagerank_result = client.run_centrality(
            algorithm="pagerank",
            parameters={
                "pagerank": {
                    "alpha": 0.85,
                    "max_iter": 100
                }
            },
            limit=5000
        )
        
        duration = time.time() - start_time
        print(f"⏱️  API call completed in {duration:.2f}s")
        
        if pagerank_result["success"]:
            print_results_summary(pagerank_result["results"], "centrality")
        else:
            print(f"❌ PageRank failed: {pagerank_result['error']}")
        
        # Run Louvain community detection
        print("\n🏘️  Running Louvain community detection...")
        start_time = time.time()
        
        louvain_result = client.run_community(
            algorithm="louvain",
            parameters={
                "louvain": {
                    "resolution": 1.0
                }
            },
            analyze_communities=True,
            limit=5000
        )
        
        duration = time.time() - start_time
        print(f"⏱️  API call completed in {duration:.2f}s")
        
        if louvain_result["success"]:
            print_results_summary(louvain_result["results"], "community")
        else:
            print(f"❌ Louvain failed: {louvain_result['error']}")
        
        # Run all algorithms (if graph is not too large)
        if graph_info['nodes'] <= 1000:
            print("\n🚀 Running all algorithms...")
            start_time = time.time()
            
            all_results = client.run_all_algorithms(
                parameters={
                    "centrality": {
                        "pagerank": {"alpha": 0.85},
                        "betweenness_centrality": {"normalized": True}
                    },
                    "community": {
                        "louvain": {"resolution": 1.0},
                        "label_propagation": {"max_iter": 30}
                    }
                },
                limit=1000
            )
            
            duration = time.time() - start_time
            print(f"⏱️  All algorithms completed in {duration:.2f}s")
            
            if all_results["success"]:
                print_results_summary(all_results["results"]["centrality"], "centrality")
                print_results_summary(all_results["results"]["community"], "community")
            else:
                print(f"❌ All algorithms failed: {all_results['error']}")
        else:
            print(f"\n⚠️  Skipping 'all algorithms' - graph too large ({graph_info['nodes']} nodes)")
        
        print(f"\n✅ Example completed successfully!")
        print(f"💾 Results have been written to Dgraph and can be queried:")
        print(f"   {{ entities(func: has(pagerank_score)) {{ name pagerank_score louvain }} }}")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")
        print("   Make sure the server is running: uv run graph-algos server")
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}")
        if hasattr(e, 'response') and e.response.text:
            try:
                error_data = json.loads(e.response.text)
                print(f"   Error details: {error_data.get('error', 'Unknown error')}")
            except json.JSONDecodeError:
                print(f"   Raw error: {e.response.text}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()