# ADR-0006: Server-side Caching

## Status

Accepted

## Date

2025-12-03

## Context

During performance analysis and load testing, we identified visible bottlenecks in API response times, particularly for frequently accessed data such as course listings, ratings, and aggregated statistics. The application was experiencing:

- High database load for read-heavy operations
- Slow response times for complex queries involving joins and aggregations
- Inefficient handling of static or infrequently changing data
- Lack of caching strategy leading to repeated expensive computations

Initial benchmarks showed that API endpoints were taking 200-700ms for such data retrieval operations. This impacted user experience and increased infrastructure costs.

## Decision

We will implement Redis-based caching with a custom caching manager and decorator pattern to provide fine-grained control over cache behavior and support educational learning objectives.

1. **Redis Cache for Flexibility and Persistence**
   - Use Redis as the primary caching backend for its in-memory performance, persistence options, and rich data structures
   - Configure Redis with appropriate eviction policies and memory limits
   - Enable persistence to survive restarts and provide data durability

2. **Custom Caching Manager and Decorator**
   - Implement a `CacheManager` class that provides low-level cache operations with configurable TTL, serialization, and key generation
     - For now supports basic cache operations: get, set, invalidate, invalidate_pattern, get_stats
     - On demand, we will implement versioned cache
   - Create a `@rcached` decorator for method-level caching that supports:
     - Automatic key generation based on method parameters
     - Configurable TTL per endpoint  
     - Value can be cached/retrieved manually by calling `CacheManager.set()` / `CacheManager.get()`
   - Create a `@invalidate_cache_for` decorator for invalidating cache for a specific method
     - Currently supports invalidating cache for a given pattern
     - Cache can be invalidated manually by calling `CacheManager.invalidate()` or `CacheManager.invalidate_pattern()`

3. **Generic JSON-Serializable Caching**
   - Support serialization of common Python data types: responses, Pydantic models, dataclasses, primitive types - is configurable with custom extensions
   - Use JSON-serializable format as the primary serialization format for compatibility and human readability
   - Implement custom serializers for complex objects that aren't natively JSON-serializable

4. **Performance Monitoring and Benchmarking**
   - Include cache hit/miss ratios in application metrics
   - Add a command to get cache stats on demand

## Consequences

### Positive

- **Performance**: 7-8x speedup for cached operations based on initial local benchmarks
- **Scalability**: Reduced database load by serving frequently requested data from memory
- **Learning Benefits**: Custom implementation provides hands-on experience with caching patterns and Redis operations
- **Flexibility**: Fine-grained control over cache behavior, TTL, and invalidation strategies
- **Data Type Support**: Generic serialization supports responses, Pydantic models, and dataclasses
- **Observability**: Cache hit/miss metrics enable performance monitoring and optimization

### Negative

- **Complexity**: Additional abstraction layer increases system complexity
- **Memory Usage**: Redis memory consumption needs monitoring and management
- **Cache Invalidation**: Requires careful management of cache keys and invalidation logic
- **Development Overhead**: Custom implementation requires more maintenance than off-the-shelf solutions
- **Learning Curve**: Team needs to understand custom caching patterns

### Additional Improvements Made During Implementation

- **Type Safety**: Strong typing for cache operations with Pydantic model support
- **Error Handling**: Graceful cache failures that don't break application functionality
- **Configuration**: Environment-based cache settings for different deployment stages
- **Testing**: Comprehensive cache testing utilities and mock implementations

## Considered Alternatives

### Alternative 1: Django Cache Framework with Database Backend

Use Django's built-in caching framework with database-backed cache storage.

**Pros**:

- Native Django integration
- Simple setup and configuration
- Automatic cache key generation

**Cons**:

- Database-backed cache defeats the purpose of performance improvement
- Limited control over cache behavior
- Less efficient than in-memory solutions

**Reason for rejection**: Database caching doesn't provide the performance benefits needed and adds unnecessary load to the database.

### Alternative 2: Django Cache Framework with Memcached

Use Django's caching framework with Memcached as the backend.

**Pros**:

- Proven technology with good performance
- Native Django integration
- Simple configuration

**Cons**:

- Less flexible than Redis for complex data structures
- Limited persistence options
- Less control over cache operations

**Reason for rejection**: Redis provides better flexibility, persistence, and richer data structures for our caching needs.

### Alternative 3: Off-the-shelf Caching Libraries (Cachetools, DiskCache)

Use Python libraries like cachetools or diskcache for in-memory/file-based caching.

**Pros**:

- Simple Python integration
- No external dependencies
- Easy to implement and test

**Cons**:

- No persistence across application restarts
- Limited scalability for distributed systems
- No built-in clustering or replication

**Reason for rejection**: Redis provides better persistence, scalability, and distributed caching capabilities needed for production deployment.
