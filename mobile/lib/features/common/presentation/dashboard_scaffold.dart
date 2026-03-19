import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/core/auth/auth_controller.dart';

class DashboardScaffold extends ConsumerWidget {
  const DashboardScaffold({
    required this.title,
    required this.subtitle,
    required this.body,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget body;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: <Widget>[
          IconButton(
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
            tooltip: 'Se deconnecter',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Text(
                subtitle,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
