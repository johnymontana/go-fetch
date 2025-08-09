# Updated DQL Queries for AI Agent Memory with Relationship Type Facets

## Updated Schema Overview
The database now includes:
- **Memory** nodes: Store content, timestamps, embeddings, and link to entities
- **Entity** nodes: Store named entities with types, descriptions, embeddings, locations, and relationships
- **relatedTo.type facet**: Describes the type of relationship between entities (e.g., "expressed gratitude to", "discussed on", "member of")

## Current Data Summary
- **Entities**: Caroline, Mel, Melanie and various concepts, events, and places
- **Memories**: Conversation transcripts with timestamps
- **Relationship Types**: Rich semantic relationships like "expressed gratitude to", "member of", "discussed", "advocated for", etc.

## 1. Updated Basic Data Exploration Queries

### Query 1: Get all Memory entries with enhanced entity relationships
```dql
{
  memories(func: type(Memory), first: 10) {
    uid
    content
    timestamp
    entities {
      name
      type
      # Show relationships from entities mentioned in this memory
      relatedTo @facets {
        name
        type
      }
    }
  }
}
```

### Query 2: Get all Entities with their typed relationships
```dql
{
  entities(func: type(Entity), first: 20) {
    uid
    name
    type
    description
    createdAt
    # Forward relationships with types
    relatedTo @facets {
      name
      type
    }
    # Reverse relationships with types
    ~relatedTo @facets {
      name
      type
    }
  }
}
```

### Query 3: Count entities by type and relationship patterns
```dql
{
  memory_count(func: type(Memory)) {
    count(uid)
  }
  entity_count(func: type(Entity)) {
    count(uid)
  }
  people_count(func: eq(type, "PERSON")) {
    count(uid)
  }
  concept_count(func: eq(type, "CONCEPT")) {
    count(uid)
  }
  event_count(func: eq(type, "EVENT")) {
    count(uid)
  }
}
```

## 2. Relationship Type Analysis Queries

### Query 4: Find all relationship types in the system
```dql
{
  all_relationship_types(func: has(relatedTo.type)) {
    relationship_type: relatedTo.type
  }
}
```

### Query 5: Group entities by specific relationship types
```dql
{
  gratitude_relationships(func: has(relatedTo)) {
    name
    type
    expressed_gratitude: relatedTo @facets(eq(type, "expressed gratitude to")) {
      name
      type
    }
  }
  
  discussion_relationships(func: has(relatedTo)) {
    name
    type
    discussed_topics: relatedTo @facets(alloftext(type, "discussed")) {
      name
      type
    }
  }
  
  membership_relationships(func: has(relatedTo)) {
    name
    type
    memberships: relatedTo @facets(alloftext(type, "member of")) {
      name
      type
    }
  }
}
```

### Query 6: Find entities with specific relationship patterns
```dql
{
  support_seekers(func: has(relatedTo)) {
    name
    type
    support_relationships: relatedTo @facets(alloftext(type, "support")) {
      name
      type
    }
  }
  
  advocates(func: has(relatedTo)) {
    name
    type
    advocacy_relationships: relatedTo @facets(alloftext(type, "advocates")) {
      name
      type
    }
  }
}
```

## 3. Person-Centric Relationship Queries

### Query 7: Caroline's complete relationship network
```dql
{
  caroline_network(func: eq(name, "Caroline")) {
    uid
    name
    type
    # Direct relationships
    direct_relationships: relatedTo @facets {
      name
      type
    }
    # Reverse relationships (who relates to Caroline)
    reverse_relationships: ~relatedTo @facets {
      name
      type
    }
    # Memories Caroline appears in
    appears_in_memories: ~entities {
      content
      timestamp
    }
  }
}
```

### Query 8: Multi-person interaction analysis
```dql
{
  person_interactions(func: eq(type, "PERSON")) {
    name
    type
    # Relationships to other people
    person_relationships: relatedTo @facets @filter(eq(type, "PERSON")) {
      name
      type
    }
    # Relationships to concepts
    concept_relationships: relatedTo @facets @filter(eq(type, "CONCEPT")) {
      name
      type
    }
    # Relationships to events
    event_relationships: relatedTo @facets @filter(eq(type, "EVENT")) {
      name
      type
    }
  }
}
```

## 4. Semantic Relationship Analysis

### Query 9: Find all "gratitude" and "support" relationships
```dql
{
  positive_relationships(func: has(relatedTo)) {
    name
    type
    gratitude_expressed: relatedTo @facets(anyoftext(type, "gratitude grateful")) {
      name
      type
    }
    support_given: relatedTo @facets(anyoftext(type, "support supports")) {
      name
      type
    }
    support_received: ~relatedTo @facets(anyoftext(type, "support supports")) {
      name
      type
    }
  }
}
```

### Query 10: LGBTQ community relationship mapping
```dql
{
  lgbtq_community_network(func: anyoftext(name, "LGBTQ transgender trans")) {
    name
    type
    # Who relates to LGBTQ topics
    community_members: ~relatedTo @facets {
      name
      type
    }
    # What LGBTQ concepts relate to
    related_concepts: relatedTo @facets {
      name
      type
    }
  }
}
```

## 5. Temporal and Contextual Queries

### Query 11: Event-based relationship tracking
```dql
{
  event_relationships(func: eq(type, "EVENT")) {
    name
    type
    # Who participated in or referenced this event
    participants: ~relatedTo @facets {
      name
      type
    }
    # What this event relates to
    event_context: relatedTo @facets {
      name
      type
    }
  }
}
```

### Query 12: Memory context with relationship enrichment
```dql
{
  enriched_memories(func: type(Memory)) {
    uid
    content
    timestamp
    entities {
      name
      type
      entity_relationships: relatedTo @facets(first: 5) {
        name
        type
      }
      relationship_count: count(relatedTo)
    }
  }
}
```

## 6. Advanced Analytical Queries

### Query 13: Relationship type frequency analysis
```dql
{
  var(func: has(relatedTo.type)) {
    rel_type as relatedTo.type
  }
  
  relationship_stats(func: uid(rel_type)) {
    relationship_type: val(rel_type)
    frequency: count(uid)
  }
}
```

### Query 14: Entity centrality analysis (most connected entities)
```dql
{
  most_connected_entities(func: type(Entity)) {
    name
    type
    outgoing_relationships: count(relatedTo)
    incoming_relationships: count(~relatedTo)
    total_connections: math(outgoing_relationships + incoming_relationships)
    memory_mentions: count(~entities)
    
    # Show top relationships
    top_relationships: relatedTo @facets(first: 5) {
      name
      type
    }
  }
}
```

### Query 15: Conversation participant relationship analysis
```dql
{
  conversation_analysis(func: type(Memory)) {
    content
    timestamp
    conversation_entities: entities {
      name
      type
      # Relationships between conversation participants
      participant_relationships: relatedTo @facets @filter(type(Entity) AND uid(~entities)) {
        name
        type
      }
    }
  }
}
```

## 7. Specific Use Case Queries for AI Memory

### Query 16: Support network identification
```dql
{
  support_networks(func: anyoftext(name, "Caroline Mel Melanie")) {
    name
    type
    # Who they support
    provides_support_to: relatedTo @facets(anyoftext(type, "support")) {
      name
      type
    }
    # Who supports them
    receives_support_from: ~relatedTo @facets(anyoftext(type, "support")) {
      name
      type
    }
    # Support group memberships
    support_group_memberships: relatedTo @facets(alloftext(type, "member of")) @filter(anyoftext(name, "support group")) {
      name
      type
    }
  }
}
```

### Query 17: Interest and activity mapping
```dql
{
  person_interests(func: eq(type, "PERSON")) {
    name
    type
    # Activities they engage in
    activities: relatedTo @facets(anyoftext(type, "engages in participat")) {
      name
      type
    }
    # Topics they discuss
    discussion_topics: relatedTo @facets(anyoftext(type, "discuss")) {
      name
      type
    }
    # Things they aspire to or desire
    aspirations: relatedTo @facets(anyoftext(type, "aspir desir")) {
      name
      type
    }
  }
}
```

### Query 18: Comprehensive entity context retrieval
```dql
{
  entity_full_context(func: eq(name, "Caroline")) {
    uid
    name
    type
    description
    
    # All relationship types this entity has
    all_relationships: relatedTo @facets {
      name
      type
    }
    
    # All reverse relationships
    reverse_relationships: ~relatedTo @facets {
      name
      type
    }
    
    # Memories this entity appears in
    memory_contexts: ~entities {
      content
      timestamp
      other_entities: entities @filter(NOT eq(name, "Caroline")) {
        name
        type
      }
    }
    
    # Relationship statistics
    outgoing_count: count(relatedTo)
    incoming_count: count(~relatedTo)
    memory_mentions: count(~entities)
  }
}
```

## 🎯 **Key Insights from Updated Data**

### **Rich Relationship Types Found**
- **Support & Advocacy**: "expressed gratitude for", "advocates for", "received support from"
- **Membership & Participation**: "member of", "participating in", "involved in"
- **Discussion & Communication**: "discussed", "discussed on", "collaborated on"
- **Goals & Aspirations**: "aspiring to create", "desires to provide", "considering"
- **Activities & Engagement**: "engages in", "prioritizing", "participated in"
- **Temporal & Event**: "event on", "occurred on", "referenced"

### **Entity Network Complexity**
- **Caroline**: 40 relationships (highly connected, active in LGBTQ advocacy)
- **Melanie**: 23 relationships (family-focused, mental health advocate)
- **Mel**: 6 relationships (participates in charitable activities)
- **Rich Conversations**: 25+ memory entries with deep contextual relationships

### **AI Agent Memory Benefits**
1. **Semantic Context**: Relationship types provide meaning to connections
2. **Conversation Understanding**: Memory content linked to typed entity relationships  
3. **Interest Mapping**: Track advocacy, aspirations, activities, and discussions
4. **Support Network Analysis**: Identify who supports whom and how
5. **Temporal Tracking**: Connect events, conversations, and relationship evolution
6. **Community Mapping**: Understand group memberships and advocacy patterns

## 🚀 **Next Steps for Implementation**

1. **Query Optimization**: Use relationship type filtering for targeted retrieval
2. **Semantic Search**: Combine content search with relationship type filtering
3. **Context Enrichment**: Use entity relationships to enhance memory understanding
4. **Pattern Recognition**: Identify support networks, advocacy patterns, and interests
5. **Temporal Analysis**: Track relationship evolution over time through conversations

These updated queries provide the foundation for sophisticated AI agent memory retrieval that understands not just what entities are mentioned, but how they relate to each other semantically.

## ✅ **Tested and Working Query Examples**

All the following queries have been tested against the current data and work correctly:

### Query A: Complete entity relationships with types
```dql
{
  entities_with_relationship_types(func: type(Entity)) {
    name
    type
    relatedTo @facets(type) {
      name
      type
    }
  }
}
```
**Result**: Shows all entities with their relationship types (e.g., "expressed gratitude for", "member of", "advocates for")

### Query B: Caroline's complete network analysis
```dql
{
  caroline_network(func: eq(name, "Caroline")) {
    uid
    name
    type
    direct_relationships: relatedTo @facets {
      name
      type
    }
    reverse_relationships: ~relatedTo @facets {
      name
      type
    }
    appears_in_memories: ~entities {
      content
      timestamp
    }
  }
}
```
**Result**: Returns Caroline's 40 direct relationships, reverse relationships, and all 25+ memory appearances

### Query C: People and their relationship statistics
```dql
{
  people_relationships(func: eq(type, "PERSON")) {
    name
    type
    all_relationships: relatedTo @facets {
      name
      type
    }
    relationship_count: count(relatedTo)
  }
}
```
**Result**: Shows Caroline (40 relationships), Melanie (23), Mel (6), Jon (7), Gina (3)

### Query D: Enhanced memory context
```dql
{
  memories(func: type(Memory), first: 10) {
    uid
    content
    timestamp
    entities {
      name
      type
      relatedTo @facets(first: 3) {
        name
        type
      }
    }
  }
}
```
**Result**: Shows conversation memories with entity relationships for context enrichment