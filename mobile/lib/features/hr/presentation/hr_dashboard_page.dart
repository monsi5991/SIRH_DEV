import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/features/common/presentation/dashboard_scaffold.dart';
import 'package:sirh_mobile/features/common/presentation/stat_card.dart';
import 'package:sirh_mobile/features/dashboard/data/dashboard_repository.dart';

class HrDashboardPage extends ConsumerWidget {
  const HrDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(hrDashboardProvider);

    return DashboardScaffold(
      title: 'Cockpit RH',
      subtitle: 'Suivez les effectifs, les operations RH et les alertes de conformite.',
      body: dashboard.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Erreur: $error')),
        data: (data) {
          final globalKpis = (data['globalKpis'] as Map<String, dynamic>? ?? const <String, dynamic>{});
          final compliance = (data['complianceSummary'] as Map<String, dynamic>? ?? const <String, dynamic>{});
          final complianceKpis = (compliance['kpis'] as Map<String, dynamic>? ?? const <String, dynamic>{});

          return RefreshIndicator(
            onRefresh: () => ref.refresh(hrDashboardProvider.future),
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
                    StatCard(label: 'Effectif total', value: '${globalKpis['totalHeadcount'] ?? 0}'),
                    StatCard(label: 'Actifs', value: '${globalKpis['activeEmployees'] ?? 0}'),
                    StatCard(label: 'Conformite a traiter', value: '${complianceKpis['overdue'] ?? 0}'),
                    StatCard(label: 'Taches de conformite', value: '${complianceKpis['total'] ?? 0}'),
                  ],
                ),
                const SizedBox(height: 16),
                Text('Payload RH recentre mobile', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Le dashboard RH mobile est branche sur /dashboard/hr et /resources/compliance/summary. '
                      'La phase suivante devra ajouter les vues detaillees: annuaire, contrats, demandes RH, policies et workflows.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
