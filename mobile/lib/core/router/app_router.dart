import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:sirh_mobile/core/auth/auth_controller.dart';
import 'package:sirh_mobile/features/auth/presentation/login_page.dart';
import 'package:sirh_mobile/features/common/presentation/loading_page.dart';
import 'package:sirh_mobile/features/employee/presentation/employee_dashboard_page.dart';
import 'package:sirh_mobile/features/hr/presentation/hr_dashboard_page.dart';
import 'package:sirh_mobile/features/manager/presentation/manager_dashboard_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/bootstrap',
    routes: <RouteBase>[
      GoRoute(
        path: '/bootstrap',
        builder: (context, state) => const LoadingPage(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/employee/dashboard',
        builder: (context, state) => const EmployeeDashboardPage(),
      ),
      GoRoute(
        path: '/manager/dashboard',
        builder: (context, state) => const ManagerDashboardPage(),
      ),
      GoRoute(
        path: '/hr/dashboard',
        builder: (context, state) => const HrDashboardPage(),
      ),
    ],
    redirect: (BuildContext context, GoRouterState state) {
      final location = state.matchedLocation;

      if (authState.isLoading) {
        return location == '/bootstrap' ? null : '/bootstrap';
      }

      final session = authState.valueOrNull;
      if (session == null) {
        return location == '/login' ? null : '/login';
      }

      if (location == '/login' || location == '/bootstrap' || location == '/') {
        return session.homeLocation;
      }

      return null;
    },
  );
});
