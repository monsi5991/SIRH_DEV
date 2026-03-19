import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/core/config/app_config.dart';
import 'package:sirh_mobile/core/router/app_router.dart';
import 'package:sirh_mobile/core/theme/app_theme.dart';

class SirhApp extends ConsumerWidget {
  const SirhApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: AppConfig.instance.appName,
      debugShowCheckedModeBanner: AppConfig.instance.enableDebugOverlay,
      theme: AppTheme.light(),
      routerConfig: router,
    );
  }
}
