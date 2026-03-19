import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/core/models/sync_change_set.dart';
import 'package:sirh_mobile/core/network/api_client.dart';

final syncRepositoryProvider = Provider<SyncRepository>((ref) {
  return SyncRepository(ref.watch(apiClientProvider));
});

class SyncRepository {
  SyncRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<SyncChangeSet> pullChanges({
    required DateTime since,
    required List<String> entityTypes,
  }) async {
    final payload = await _apiClient.getMap(
      '/sync/changes',
      queryParameters: <String, dynamic>{
        'since': since.toUtc().toIso8601String(),
        'entity_types': entityTypes.join(','),
      },
    );
    return SyncChangeSet.fromJson(payload);
  }
}
