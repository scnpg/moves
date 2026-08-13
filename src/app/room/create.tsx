import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { HoverPressable } from '@/components/HoverPressable';
import { LocationPicker, type LocationValue } from '@/components/LocationPicker';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SubHeader } from '@/components/SubHeader';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { WheelPicker } from '@/components/WheelPicker';
import { getFriendOfFriendSuggestions, getMyFriends, getReferralCount } from '@/features/friends/api';
import { addMoveExclusions, checkTitleForModeration, createMove } from '@/features/moves/api';
import { searchUsers } from '@/features/search/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { confirmAction, notify } from '@/lib/alerts';
import type { DegreeLimit, FriendListItem, FriendOfFriendSuggestion, SearchUserResult } from '@/lib/database.types';
import { isCloseFriendsUnlocked, isPrivateUnlocked, nextMilestoneLabel } from '@/lib/referrals';
import { combineDateAndTime, timeString } from '@/lib/time';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

interface PickedUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

function formatTime(hhmm: string, format: '12h' | '24h'): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (format === '24h') return `${pad2(h)}:${pad2(m)}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Start/end date+time are now paired fields in the main section - only one popover open at a time. */
type OpenField = 'startDate' | 'startTime' | 'endDate' | 'endTime' | null;

export default function CreateMoveScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { colors, border, font } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [degreeLimit, setDegreeLimit] = useState<DegreeLimit>(3);
  const [startTime, setStartTime] = useState(() => timeString(new Date()));
  const [endTime, setEndTime] = useState(() => timeString(new Date(Date.now() + 2 * 60 * 60_000)));
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [openField, setOpenField] = useState<OpenField>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [maxMembers, setMaxMembers] = useState('');
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [excludedUsers, setExcludedUsers] = useState<Map<string, PickedUser>>(new Map());

  useEffect(() => {
    if (!session?.user) return;
    getReferralCount(session.user.id)
      .then(setReferralCount)
      .catch(() => setReferralCount(0));
  }, [session?.user]);

  const toggleExcluded = (user: PickedUser) => {
    setExcludedUsers((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.set(user.id, user);
      return next;
    });
  };

  const privateLocked = !isPrivateUnlocked(referralCount ?? 0);
  const closeFriendsLocked = !isCloseFriendsUnlocked(referralCount ?? 0);

  const DEGREE_ROWS: { value: DegreeLimit; label: string; disabled?: boolean }[] = [
    { value: 4, label: t('createMove.closeFriendsOption'), disabled: closeFriendsLocked },
    { value: 1, label: t('createMove.friendsOption') },
    { value: 2, label: t('createMove.mutualsOption') },
    { value: 3, label: t('createMove.openOption') },
    { value: 0, label: t('createMove.privateOption'), disabled: privateLocked },
  ];

  const hasUnsavedInput =
    title.trim() !== '' ||
    description.trim() !== '' ||
    maxMembers.trim() !== '' ||
    requiresApproval ||
    location != null ||
    excludedUsers.size > 0;

  const handleClose = async () => {
    if (hasUnsavedInput) {
      const confirmed = await confirmAction(
        t('createMove.discardTitle'),
        t('createMove.discardMessage'),
        t('createMove.discard')
      );
      if (!confirmed) return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const canStart = title.trim().length > 0 && location != null;

  const handleCreate = async () => {
    if (!session?.user) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      notify(t('createMove.titleRequired'), t('createMove.giveTitle'));
      return;
    }
    if (location == null) {
      notify(t('createMove.locationRequired'), t('createMove.locationRequiredMessage'));
      return;
    }

    const parsedMax = maxMembers.trim() ? Number(maxMembers) : null;
    if (parsedMax != null && (!Number.isInteger(parsedMax) || parsedMax <= 0)) {
      notify(t('createMove.invalidCap'), t('createMove.maxMembersError'));
      return;
    }

    const startsAt = combineDateAndTime(startDate, startTime);
    const expiresAt = combineDateAndTime(endDate, endTime);
    if (expiresAt.getTime() <= startsAt.getTime()) {
      notify(t('createMove.invalidEndTime'), t('createMove.invalidEndTimeMessage'));
      return;
    }

    setSubmitting(true);
    try {
      const moderation = await checkTitleForModeration(trimmedTitle);
      if (moderation.verdict === 'blocked') {
        notify(t('createMove.titleInappropriate'), t('createMove.titleInappropriateMessage'));
        return;
      }

      const move = await createMove({
        hostId: session.user.id,
        title: trimmedTitle,
        description: description.trim() || null,
        degreeLimit,
        requiresApproval,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxMembers: parsedMax,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        chatEnabled,
      });
      if (excludedUsers.size > 0) {
        // Best-effort: the Move already exists at this point, so a failure
        // here shouldn't block the host from landing on it - it just means
        // the blacklist didn't take and they'd need to re-apply it.
        await addMoveExclusions(move.id, [...excludedUsers.keys()]).catch(() => {
          notify(t('createMove.couldNotBlacklist'), t('common.pleaseTryAgain'));
        });
      }
      router.replace(
        `/room/created?id=${move.id}&title=${encodeURIComponent(move.title)}&startsAt=${encodeURIComponent(move.starts_at)}&expiresAt=${encodeURIComponent(move.expires_at)}&shareToken=${encodeURIComponent(move.share_token)}&degreeLimit=${move.degree_limit}`
      );
    } catch (err) {
      notify(t('createMove.couldNotCreate'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen style={styles.noPadding}>
      <SubHeader title={t('createMove.newMove')} onBack={handleClose} variant="close" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
        <TextField
          label={t('createMove.titleLabel')}
          required
          value={title}
          onChangeText={setTitle}
          placeholder={t('createMove.titlePlaceholder')}
          style={styles.titleInput}
          multiline
        />

        <View style={styles.timeRow}>
          <View style={styles.timeCol}>
            <DatePicker
              label={t('createMove.startDateLabel')}
              value={startDate}
              onChange={setStartDate}
              open={openField === 'startDate'}
              onToggle={() => setOpenField((f) => (f === 'startDate' ? null : 'startDate'))}
            />
          </View>
          <View style={styles.timeCol}>
            <TimeDropdown
              label={t('createMove.starts')}
              value={startTime}
              onChange={setStartTime}
              open={openField === 'startTime'}
              onToggle={() => setOpenField((f) => (f === 'startTime' ? null : 'startTime'))}
            />
          </View>
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeCol}>
            <DatePicker
              label={t('createMove.endDateLabel')}
              value={endDate}
              onChange={setEndDate}
              open={openField === 'endDate'}
              onToggle={() => setOpenField((f) => (f === 'endDate' ? null : 'endDate'))}
            />
          </View>
          <View style={styles.timeCol}>
            <TimeDropdown
              label={t('createMove.endTime')}
              value={endTime}
              onChange={setEndTime}
              open={openField === 'endTime'}
              onToggle={() => setOpenField((f) => (f === 'endTime' ? null : 'endTime'))}
            />
          </View>
        </View>

        <Field label={t('createMove.locationLabel')} required>
          <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular, marginTop: 0, marginBottom: 8 }]}>
            {degreeLimit === 1 ? t('createMove.locationVisibleFriends') : t('createMove.locationHiddenUntilApproved')}
          </Text>
          <LocationPicker value={location} onChange={setLocation} />
        </Field>

        <Field label={t('createMove.whoCanSeeJoin')}>
          {(() => {
            const selectedRow = DEGREE_ROWS.find((row) => row.value === degreeLimit)!;
            return (
              <>
                <Pressable
                  onPress={() => setWhoOpen((o) => !o)}
                  style={[
                    styles.whoTrigger,
                    {
                      backgroundColor: colors.well,
                      borderWidth: whoOpen ? border.focused.width : border.rest.width,
                      borderColor: whoOpen ? border.focused.color : border.rest.color,
                    },
                  ]}
                >
                  <View style={styles.whoTriggerText}>
                    <Text style={[styles.degreeLabel, { fontFamily: font.family.monoBold, color: colors.textPrimary }]}>
                      {selectedRow.label.toUpperCase()}
                    </Text>
                    <Text style={[styles.degreeDescription, { fontFamily: font.family.bodyRegular, color: colors.textMuted }]}>
                      {t(`degree.description.${selectedRow.value}`)}
                    </Text>
                  </View>
                  <Text style={[styles.whoChevron, { color: colors.textPrimary }]}>{whoOpen ? '▴' : '▾'}</Text>
                </Pressable>

                {whoOpen ? (
                  <View style={[styles.degreeList, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
                    {DEGREE_ROWS.map((row, i) => {
                      const selected = row.value === degreeLimit;
                      return (
                        <Pressable
                          key={row.value}
                          onPress={() => {
                            if (row.disabled) return;
                            setDegreeLimit(row.value);
                            setWhoOpen(false);
                          }}
                          style={[
                            styles.degreeRow,
                            i > 0 && { borderTopWidth: border.soft.width, borderTopColor: border.soft.color },
                            { backgroundColor: selected ? colors.border : row.disabled ? colors.bgElevated : 'transparent' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.degreeLabel,
                              { fontFamily: font.family.monoBold, color: selected ? colors.textInverse : row.disabled ? colors.textMuted : colors.textPrimary },
                            ]}
                          >
                            {row.disabled ? '🔒 ' : ''}
                            {row.label.toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              styles.degreeDescription,
                              { fontFamily: font.family.bodyRegular, color: selected ? colors.brand : colors.textMuted },
                            ]}
                          >
                            {t(`degree.description.${row.value}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </>
            );
          })()}
          {nextMilestoneLabel(referralCount ?? 0, t) ? (
            <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
              {t('createMove.progress', { label: nextMilestoneLabel(referralCount ?? 0, t)! })}
            </Text>
          ) : null}
        </Field>

        <Pressable onPress={() => setMoreOpen((o) => !o)} style={styles.moreToggle}>
          <Text style={[styles.moreToggleText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
            {t('createMove.moreOptions')}
          </Text>
          <Text style={[styles.moreToggleChevron, { color: colors.textPrimary }]}>{moreOpen ? '▴' : '▾'}</Text>
        </Pressable>

        {moreOpen ? (
          <View style={styles.moreContent}>
            <TextField
              label={t('createMove.descriptionLabel')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('createMove.descriptionPlaceholder')}
              multiline
            />

            <TextField
              label={t('createMove.maxPeopleLabel')}
              value={maxMembers}
              onChangeText={setMaxMembers}
              placeholder={t('createMove.noCap')}
              keyboardType="number-pad"
            />

            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.toggleLabel, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
                  {t('createMove.requireApproval')}
                </Text>
                <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                  {t('createMove.requireApprovalHelp')}
                </Text>
              </View>
              <Toggle checked={requiresApproval} onChange={setRequiresApproval} />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.toggleLabel, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
                  {t('createMove.groupChat')}
                </Text>
                <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                  {chatEnabled ? t('createMove.groupChatOnHelp') : t('createMove.groupChatOffHelp')}
                </Text>
              </View>
              <Toggle checked={chatEnabled} onChange={setChatEnabled} />
            </View>

            <Field label={t('createMove.blacklistedUsers')}>
              <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular, marginTop: 0, marginBottom: 10 }]}>
                {t('createMove.blacklistedUsersHelp')}
              </Text>
              <BlacklistPicker excluded={excludedUsers} onToggle={toggleExcluded} />
            </Field>
          </View>
        ) : null}

        <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      <View style={[styles.pinnedBar, { borderTopWidth: border.rest.width, borderTopColor: border.rest.color, backgroundColor: colors.bg }]}>
        <View style={styles.column}>
          <Button label={t('createMove.startIt')} onPress={handleCreate} loading={submitting} disabled={!canStart} size="lg" />
        </View>
      </View>
    </Screen>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { colors, font } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
        {label.toUpperCase()}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function TimeDropdown({
  label,
  value,
  onChange,
  open,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { colors, border, font, timeFormat } = useTheme();
  const { t } = useLocale();
  const selectedLabel = formatTime(value, timeFormat);
  const [hour24, minute] = value.split(':').map(Number);
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const setHour24 = (h: number) => onChange(`${pad2(h)}:${pad2(minute)}`);
  const setHour12 = (h12: number) => setHour24(isPM ? (h12 % 12) + 12 : h12 % 12);
  const setPM = (pm: boolean) => setHour24(pm ? (hour24 % 12) + 12 : hour24 % 12);

  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{label.toUpperCase()}</Text>
      <Pressable
        onPress={onToggle}
        style={[
          styles.whoTrigger,
          { backgroundColor: colors.well, borderWidth: open ? border.focused.width : border.rest.width, borderColor: open ? border.focused.color : border.rest.color },
        ]}
      >
        <Text style={[styles.degreeLabel, { fontFamily: font.family.bodySemibold, color: colors.textPrimary, fontSize: 15, letterSpacing: 0 }]}>
          {selectedLabel}
        </Text>
        <Text style={[styles.whoChevron, { color: colors.textPrimary }]}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <View style={[styles.degreeList, styles.timeWheels, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
          <View style={styles.wheelRow}>
            {timeFormat === '24h' ? (
              <WheelPicker values={HOURS_24} value={hour24} onChange={setHour24} formatValue={pad2} />
            ) : (
              <WheelPicker values={HOURS_12} value={hour12} onChange={setHour12} formatValue={String} />
            )}
            <WheelPicker values={MINUTES} value={minute} onChange={(m) => onChange(`${pad2(hour24)}:${pad2(m)}`)} formatValue={pad2} />
          </View>
          {timeFormat === '12h' ? (
            <SegmentedControl
              segments={[
                { value: 'am', label: t('createMove.am') },
                { value: 'pm', label: t('createMove.pm') },
              ]}
              value={isPM ? 'pm' : 'am'}
              onChange={(v) => setPM(v === 'pm')}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateTrigger(date: Date, t: (key: any, params?: any) => string): string {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = startOfDay(date);
  if (d.getTime() === today.getTime()) return t('common.time.today');
  if (d.getTime() === tomorrow.getTime()) return t('common.time.tomorrow');
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Jan 4 1970 was a Sunday - reads back each weekday's locale-narrow label
// (S/M/T/...) without hardcoding English day names.
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  new Date(1970, 0, 4 + i).toLocaleDateString(undefined, { weekday: 'narrow' })
);

function DatePicker({
  label,
  value,
  onChange,
  open,
  onToggle,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { colors, border, font } = useTheme();
  const { t } = useLocale();
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  useEffect(() => {
    if (open) setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = startOfDay(new Date());
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const canGoPrev = viewMonth.getTime() > minMonth.getTime();
  const selectedTime = startOfDay(value).getTime();

  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{label.toUpperCase()}</Text>
      <Pressable
        onPress={onToggle}
        style={[
          styles.whoTrigger,
          { backgroundColor: colors.well, borderWidth: open ? border.focused.width : border.rest.width, borderColor: open ? border.focused.color : border.rest.color },
        ]}
      >
        <Text style={[styles.degreeLabel, { fontFamily: font.family.bodySemibold, color: colors.textPrimary, fontSize: 15, letterSpacing: 0 }]}>
          {formatDateTrigger(value, t)}
        </Text>
        <Text style={[styles.whoChevron, { color: colors.textPrimary }]}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <View style={[styles.degreeList, styles.calendarBox, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
          <View style={styles.calendarHeader}>
            <HoverPressable
              onPress={() => canGoPrev && setViewMonth(new Date(year, month - 1, 1))}
              style={styles.calendarNavButton}
              disabled={!canGoPrev}
            >
              <Text style={[styles.calendarNavText, { color: canGoPrev ? colors.textPrimary : colors.textMuted }]}>‹</Text>
            </HoverPressable>
            <Text style={[styles.calendarMonthLabel, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
              {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <HoverPressable onPress={() => setViewMonth(new Date(year, month + 1, 1))} style={styles.calendarNavButton}>
              <Text style={[styles.calendarNavText, { color: colors.textPrimary }]}>›</Text>
            </HoverPressable>
          </View>

          <View style={styles.calendarWeekdayRow}>
            {WEEKDAY_LABELS.map((w, i) => (
              <Text key={i} style={[styles.calendarWeekdayText, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((day, i) => {
              if (day == null) return <View key={i} style={styles.calendarCell} />;
              const cellDate = startOfDay(new Date(year, month, day));
              const disabled = cellDate.getTime() < today.getTime();
              const selected = cellDate.getTime() === selectedTime;
              return (
                <Pressable
                  key={i}
                  disabled={disabled}
                  onPress={() => {
                    onChange(cellDate);
                    onToggle();
                  }}
                  style={[styles.calendarCell, selected && { backgroundColor: colors.border }]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      { fontFamily: font.family.bodyRegular, color: selected ? colors.textInverse : disabled ? colors.textMuted : colors.textPrimary, opacity: disabled ? 0.4 : 1 },
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Search-any-user picker for the blacklist. The empty-query dropdown shows
 * two sections (friends, then friends-of-friends); once a query is typed,
 * search_users() results are re-sorted client-side by that same tiering
 * (friend -> friend-of-friend -> everyone else) rather than left in
 * whatever order the RPC returned.
 */
function BlacklistPicker({ excluded, onToggle }: { excluded: Map<string, PickedUser>; onToggle: (user: PickedUser) => void }) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [fof, setFof] = useState<FriendOfFriendSuggestion[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getMyFriends().then(setFriends).catch(() => setFriends([]));
    getFriendOfFriendSuggestions().then(setFof).catch(() => setFof([]));
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        setSearchResults(await searchUsers(trimmed));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const fofIds = useMemo(() => new Set(fof.map((f) => f.id)), [fof]);
  const tierOf = (id: string) => (friendIds.has(id) ? 0 : fofIds.has(id) ? 1 : 2);

  const isSearching = query.trim().length > 0;
  const visibleFriends = friends.filter((f) => !excluded.has(f.id));
  const visibleFof = fof.filter((f) => !excluded.has(f.id));
  const sortedResults = useMemo(
    () =>
      searchResults
        .filter((u) => !excluded.has(u.id))
        .slice()
        .sort((a, b) => tierOf(a.id) - tierOf(b.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchResults, excluded, friendIds, fofIds]
  );

  const row = (user: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => (
    <Pressable
      key={user.id}
      onPress={() => onToggle({ id: user.id, name: user.display_name ?? user.username, avatarUrl: user.avatar_url })}
      style={styles.blacklistRow}
    >
      <Avatar uri={user.avatar_url} name={user.display_name ?? user.username} size={32} />
      <View style={styles.blacklistRowText}>
        <Text style={[styles.blacklistName, { color: colors.textPrimary, fontFamily: font.family.bodyRegular }]} numberOfLines={1}>
          {user.display_name ?? user.username}
        </Text>
        <Text style={[styles.blacklistUsername, { color: colors.textMuted, fontFamily: font.family.monoRegular }]} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View>
      <TextField value={query} onChangeText={setQuery} placeholder={t('createMove.blacklistSearchPlaceholder')} autoCapitalize="none" />

      {excluded.size > 0 ? (
        <View style={styles.blacklistChips}>
          {[...excluded.values()].map((user) => (
            <HoverPressable
              key={user.id}
              onPress={() => onToggle(user)}
              style={[styles.blacklistChip, { borderWidth: border.rest.width, borderColor: colors.border, backgroundColor: colors.danger }]}
            >
              <Text style={[styles.blacklistChipText, { color: colors.textInverse, fontFamily: font.family.bodyRegular }]} numberOfLines={1}>
                {user.name} ×
              </Text>
            </HoverPressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.blacklistDropdown, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
        <ScrollView style={styles.blacklistScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {isSearching ? (
            searching ? (
              <Text style={[styles.blacklistEmpty, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                {t('createMove.searching')}
              </Text>
            ) : sortedResults.length === 0 ? (
              <Text style={[styles.blacklistEmpty, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                {t('search.noUsersFound', { query: query.trim() })}
              </Text>
            ) : (
              sortedResults.map(row)
            )
          ) : (
            <>
              {visibleFriends.length > 0 ? (
                <>
                  <Text style={[styles.blacklistSectionHeader, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                    {t('profile.friends').toUpperCase()}
                  </Text>
                  {visibleFriends.map(row)}
                </>
              ) : null}
              {visibleFof.length > 0 ? (
                <>
                  <Text style={[styles.blacklistSectionHeader, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                    {t('search.friendsOfFriends').toUpperCase()}
                  </Text>
                  {visibleFof.map(row)}
                </>
              ) : null}
              {visibleFriends.length === 0 && visibleFof.length === 0 ? (
                <Text style={[styles.blacklistEmpty, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                  {t('createMove.noFriendsToBlacklist')}
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noPadding: {
    padding: 0,
  },
  content: {
    padding: 16,
    // Centers the column below on a wide viewport - alignSelf has no effect
    // on a ScrollView's own contentContainerStyle, so the actual maxWidth
    // cap lives on the `column` wrapper View instead.
    alignItems: 'center',
  },
  column: {
    width: '100%',
    // Caps the column (and everything that inherits its width - the "Start
    // it" button, and every popover/dropdown that pops out of a field:
    // time wheels, calendar, who-can-see list, blacklist search) to a
    // comfortable reading width instead of stretching edge-to-edge on a
    // wide desktop viewport. No-op on mobile, where the viewport is
    // already narrower than this.
    maxWidth: 480,
  },
  titleInput: {
    fontSize: 22,
    lineHeight: 26,
    minHeight: 72,
  },
  field: {
    marginTop: 24,
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  whoTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  whoTriggerText: {
    flex: 1,
    gap: 2,
  },
  whoChevron: {
    fontSize: 16,
    marginLeft: 12,
  },
  degreeList: {
    marginTop: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  timeCol: {
    flex: 1,
  },
  timeWheels: {
    padding: 12,
    gap: 10,
  },
  wheelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calendarBox: {
    padding: 12,
    gap: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNavButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavText: {
    fontSize: 20,
  },
  calendarMonthLabel: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
  },
  calendarWeekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 13,
  },
  degreeRow: {
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  degreeLabel: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  degreeDescription: {
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  moreToggle: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  moreToggleText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  moreToggleChevron: {
    fontSize: 14,
  },
  moreContent: {
    gap: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 3,
  },
  toggleLabel: {
    fontSize: 14,
  },
  blacklistChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  blacklistChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 200,
  },
  blacklistChipText: {
    fontSize: 12,
  },
  blacklistDropdown: {
    marginTop: 10,
    overflow: 'hidden',
  },
  blacklistScroll: {
    maxHeight: 240,
  },
  blacklistSectionHeader: {
    fontSize: 10,
    letterSpacing: 0.9,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  blacklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  blacklistRowText: {
    flex: 1,
    gap: 1,
  },
  blacklistName: {
    fontSize: 14,
  },
  blacklistUsername: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  blacklistEmpty: {
    fontSize: 13,
    padding: 12,
  },
  bottomSpacer: {
    height: 88,
  },
  pinnedBar: {
    padding: 16,
    alignItems: 'center',
  },
});
