import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/features/common/presentation/dashboard_scaffold.dart';
import 'package:sirh_mobile/features/common/presentation/stat_card.dart';
import 'package:sirh_mobile/features/dashboard/data/dashboard_repository.dart';

class EmployeeDashboardPage extends ConsumerWidget {
  const EmployeeDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(employeeDashboardProvider);

    return DashboardScaffold(
      title: 'Mon espace RH',
      subtitle: 'Retrouvez vos demandes, vos conges et vos priorites du moment.',
      body: dashboard.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Erreur: $error')),
        data: (data) {
          final leaveBalances = (data['leaveBalances'] as List<dynamic>? ?? const <dynamic>[]);
          final recentRequests = (data['recentRequests'] as List<dynamic>? ?? const <dynamic>[]);
          final urgentDocuments = (data['pendingDocuments'] as List<dynamic>? ?? const <dynamic>[]);

          return RefreshIndicator(
            onRefresh: () => ref.refresh(employeeDashboardProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                GridView.count(
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.6,
                  children: <Widget>[
                    StatCard(label: 'Types de conges suivis', value: '${leaveBalances.length}'),
                    StatCard(label: 'Demandes recentes', value: '${recentRequests.length}'),
                    StatCard(label: 'Documents a traiter', value: '${urgentDocuments.length}'),
                    StatCard(label: 'Actions urgentes', value: '${urgentDocuments.length + recentRequests.length}'),
                  ],
                ),
                const SizedBox(height: 16),
                Text('Mes demandes en cours', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ListView.builder(
                  itemCount: recentRequests.length,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemBuilder: (context, index) {
                    final item = recentRequests[index] as Map<String, dynamic>;
                    return Card(
                      child: ListTile(
                        title: Text(item['label']?.toString() ?? 'Demande RH'),
                        subtitle: Text(item['status']?.toString() ?? 'En cours'),
                      ),
                    );
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
