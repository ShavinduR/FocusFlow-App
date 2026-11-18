import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTaskStore } from '../../src/store/useTaskStore';
import { unsyncedCount } from '../../src/sync/authService';
import { SYNC_ENABLED } from '../../src/sync/config';
import { useSyncStore, type SyncPhase } from '../../src/sync/useSyncStore';
import { useTheme } from '../../src/theme/useTheme';
import { withAlpha } from '../../src/theme/tokens';
import { haptics } from '../../src/utils/haptics';
import { relativeTime } from '../../src/utils/relativeTime';

export default function AccountScreen() {
  const { colors, fonts } = useTheme();
  const session = useAuthStore((s) => s.session);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semibold }]}>Account</Text>
        {SYNC_ENABLED && session ? (
          <>
            <ProfileCard name={session.user.name} email={session.user.email} />
            <SyncCard />
            <SignOut />
          </>
        ) : (
          <LocalOnlyCard />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(350)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {children}
    </Animated.View>
  );
}

function ProfileCard({ name, email }: { name: string; email: string }) {
  const { colors, fonts } = useTheme();
  const initial = (name || email).trim().charAt(0).toUpperCase();
  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
          <Text style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 20 }}>{initial}</Text>
        </View>
        <View style={styles.flex}>
          {!!name && <Text style={[styles.name, { color: colors.text, fontFamily: fonts.semibold }]}>{name}</Text>}
          <Text style={[styles.muted, { color: colors.textMuted, fontFamily: fonts.regular }]} numberOfLines={1}>{email}</Text>
        </View>
      </View>
    </Card>
  );
}

const PHASE_COPY: Record<SyncPhase, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  idle: { label: 'Up to date', icon: 'cloud-done-outline' },
  syncing: { label: 'Syncing…', icon: 'sync-outline' },
  offline: { label: 'Offline: changes are saved on this device', icon: 'cloud-offline-outline' },
  error: { label: 'Sync paused. We’ll retry automatically', icon: 'alert-circle-outline' },
  signed_out: { label: 'Signed out', icon: 'cloud-outline' },
  disabled: { label: 'Sync is off', icon: 'cloud-outline' },
};

function SyncCard() {
  const { colors, fonts } = useTheme();
  const { phase, lastSyncedAt, trigger } = useSyncStore();
  const db = useTaskStore((s) => s.db);
  const [pending, setPending] = useState(0);
  const [, forceTick] = useState(0);

  // Recount unsynced edits whenever sync state changes or the tab gains focus.
  const recount = useCallback(() => {
    if (db) unsyncedCount(db).then(setPending);
  }, [db]);
  useEffect(recount, [recount, phase, lastSyncedAt]);
  useFocusEffect(recount);
  // Keep "2 min ago" fresh.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const copy = PHASE_COPY[phase];
  const tint = phase === 'error' ? colors.danger : phase === 'idle' ? colors.success : colors.textMuted;

  return (
    <Card delay={60}>
      <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semibold }]}>Cloud sync</Text>
      <View style={[styles.row, styles.statusRow]}>
        <Ionicons name={copy.icon} size={20} color={tint} />
        <Text style={[styles.flex, styles.body, { color: colors.text, fontFamily: fonts.regular }]}>{copy.label}</Text>
      </View>
      <Text style={[styles.muted, { color: colors.textMuted, fontFamily: fonts.regular }]}>
        Last synced: {relativeTime(lastSyncedAt)}
        {pending > 0 ? `  ·  ${pending} change${pending === 1 ? '' : 's'} waiting` : ''}
      </Text>
      <Button
        title="Sync now"
        variant="secondary"
        onPress={() => trigger?.()}
        loading={phase === 'syncing'}
        style={styles.cardButton}
      />
    </Card>
  );
}

function SignOut() {
  const { colors, fonts } = useTheme();
  const signOut = useAuthStore((s) => s.signOut);
  const db = useTaskStore((s) => s.db);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (db) setPending(await unsyncedCount(db));
    haptics.medium();
    setConfirming(true);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await signOut(); // root layout switches to the auth screens
    } finally {
      setBusy(false);
    }
  };

  // An inline confirmation instead of Alert.alert, which react-native-web doesn't support.
  return (
    <Card delay={120}>
      {!confirming ? (
        <Button title="Sign out" variant="danger" onPress={ask} />
      ) : (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semibold }]}>Sign out of FocusFlow?</Text>
          <Text style={[styles.body, { color: colors.textMuted, fontFamily: fonts.regular, marginBottom: 12 }]}>
            Your tasks stay safe in the cloud and will be removed from this device. Sign in again to bring them back.
          </Text>
          {pending > 0 && (
            <View style={[styles.warning, { backgroundColor: withAlpha(colors.danger, 0.08), borderColor: withAlpha(colors.danger, 0.25) }]}>
              <Ionicons name="warning-outline" size={18} color={colors.danger} />
              <Text style={[styles.flex, styles.body, { color: colors.text, fontFamily: fonts.regular }]}>
                {pending} change{pending === 1 ? ' hasn’t' : 's haven’t'} synced yet and will be lost. Go online and sync first to keep {pending === 1 ? 'it' : 'them'}.
              </Text>
            </View>
          )}
          <View style={styles.confirmRow}>
            <Button title="Cancel" variant="secondary" onPress={() => setConfirming(false)} style={styles.flex} />
            <Button
              title={pending > 0 ? 'Sign out anyway' : 'Sign out'}
              variant="danger"
              onPress={confirm}
              loading={busy}
              style={styles.flex}
            />
          </View>
        </Animated.View>
      )}
    </Card>
  );
}

function LocalOnlyCard() {
  const { colors, fonts } = useTheme();
  return (
    <Card>
      <View style={[styles.row, styles.statusRow]}>
        <Ionicons name="phone-portrait-outline" size={20} color={colors.textMuted} />
        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semibold, marginBottom: 0 }]}>On this device only</Text>
      </View>
      <Text style={[styles.body, { color: colors.textMuted, fontFamily: fonts.regular }]}>
        Cloud sync isn’t configured in this build, so your tasks are stored only on this device. Set EXPO_PUBLIC_API_URL to enable accounts and sync.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' },
  title: { fontSize: 28, marginBottom: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 18, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17 },
  muted: { fontSize: 13 },
  cardTitle: { fontSize: 16, marginBottom: 10 },
  statusRow: { gap: 10, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21 },
  cardButton: { marginTop: 14, minHeight: 46 },
  warning: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  confirmRow: { flexDirection: 'row', gap: 10 },
});
