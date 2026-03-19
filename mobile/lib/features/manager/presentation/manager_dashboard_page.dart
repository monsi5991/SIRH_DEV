import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/features/common/presentation/dashboard_scaffold.dart';
import 'package:sirh_mobile/features/common/presentation/stat_card.dart';
import 'package:sirh_mobile/features/dashboard/data/dashboard_repository.dart';

class ManagerDashboardPage extends ConsumerWidget {
  const ManagerDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(managerDashboardProvider);

    return DashboardScaffold(
      title: 'Pilotage manager',
      subtitle: 'Centralisez les validations, la presence et les alertes de votre equipe.',
      body: dashboard.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Erreur: $error')),
        data: (data) {
          final approvals = (data['approvalsSummary'] as Map<String, dynamic>? ?? const <String, dynamic>{});
          final pendingApprovals = (data['pendingApprovals'] as List<dynamic>? ?? const <dynamic>[]);
          final absentees = (data['teamAbsentees'] as List<dynamic>? ?? const <dynamic>[]);

          return RefreshIndicator(
            onRefresh: () => ref.refresh(managerDashboardProvider.future),
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
                    StatCard(label: 'Conges a valider', value: '${approvals['leavePendingCount'] ?? 0}'),
                    StatCard(label: 'Temps a valider', value: '${approvals['timesheetPendingCount'] ?? 0}'),
                    StatCard(label: 'Frais a valider', value: '${approvals['expensePendingCount'] ?? 0}'),
                    StatCard(label: 'Demandes RH', value: '${approvals['hrRequestPendingCount'] ?? 0}'),
                  ],
                ),
                const SizedBox(height: 16),
                Text('A valider', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ListView.builder(
                  itemCount: pendingApprovals.length,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemBuilder: (context, index) {
                    final item = pendingApprovals[index] as Map<String, dynamic>;
                    return Card(
                      child: ListTile(
                        title: Text(item['employeeName']?.toString() ?? 'Collaborateur'),
                        subtitle: Text(item['title']?.toString() ?? item['type']?.toString() ?? 'Validation'),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 16),
                Text('Absences du jour', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ListView.builder(
                  itemCount: absentees.length,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemBuilder: (context, index) {
                    final item = absentees[index] as Map<String, dynamic>;
                    return Card(
                      child: ListTile(
                        title: Text(item['employeeName']?.toString() ?? 'Collaborateur'),
                        subtitle: Text(item['status']?.toString() ?? 'Absence'),
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
