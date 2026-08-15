# Redis Streams implementation reference

The implementation follows the official Redis Node.js streaming guidance: events are appended with `XADD` using approximate `MAXLEN` trimming; consumers use `XREADGROUP` and acknowledge only after dispatch with `XACK`; unacknowledged messages are recovered through `XAUTOCLAIM`; and each blocking consumer uses a dedicated Redis connection because blocking reads should not share a command connection with producers. Redis recommends idempotent downstream handling because Streams consumer groups provide at-least-once rather than exactly-once delivery.

For horizontal WebSocket fanout, this project creates a dedicated consumer group per gateway instance. A shared group would distribute events between replicas, causing clients connected to other pods to miss updates. A group per replica intentionally duplicates consumption only for the realtime fanout projection; worker queues that must distribute computational work should instead use one shared worker group.

Source: https://redis.io/docs/latest/develop/use-cases/streaming/nodejs/
