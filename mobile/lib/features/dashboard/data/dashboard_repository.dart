import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/core/network/api_client.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepository(ref.watch(apiClientProvider));
});

final employeeDashboardProvider = FutureProvider<Map<String, dynamic>>((ref) {
  return ref.watch(dashboardRepositoryProvider).fetchEmployeeDashboard();
});

final managerDashboardProvider = FutureProvider<Map<String, dynamic>>((ref) {
  return ref.watch(dashboardRepositoryProvider).fetchManagerDashboard();
});

final hrDashboardProvider = FutureProvider<Map<String, dynamic>>((ref) {
  return ref.watch(dashboardRepositoryProvider).fetchHrDashboard();
});

class DashboardRepository {
  DashboardRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> fetchEmployeeDashboard() {
    return _apiClient.getMap('/dashboard/employee');
  }

  Future<Map<String, dynamic>> fetchManagerDashboard() {
    return _apiClient.getMap('/dashboard/manager');
  }

  Future<Map<String, dynamic>> fetchHrDashboard() async {
    final dashboard = await _apiClient.getMap('/dashboard/hr');
    final compliance = await _apiClient.getMap('/resources/compliance/summary');
    return <String, dynamic>{
      ...dashboard,
      'complianceSummary': compliance,
    };
  }
}
