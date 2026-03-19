class SyncChangeSet {
  const SyncChangeSet({
    required this.timestamp,
    required this.entityTypes,
    required this.changes,
    required this.hasMore,
  });

  final DateTime timestamp;
  final List<String> entityTypes;
  final Map<String, dynamic> changes;
  final bool hasMore;

  factory SyncChangeSet.fromJson(Map<String, dynamic> json) {
    return SyncChangeSet(
      timestamp: DateTime.tryParse(json['sync_timestamp']?.toString() ?? '') ?? DateTime.now(),
      entityTypes: (json['entity_types'] as List<dynamic>? ?? const <dynamic>[])
          .map((item) => item.toString())
          .toList(growable: false),
      changes: (json['changes'] as Map<String, dynamic>? ?? const <String, dynamic>{}),
      hasMore: json['has_more'] == true,
    );
  }
}
