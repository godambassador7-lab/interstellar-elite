import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';

export const DEFENSE_DOCTRINES = [
  {
    id: 'fortress',
    title: 'FORTRESS',
    desc: 'Higher station durability. Better anti-siege survival.',
  },
  {
    id: 'sniper_grid',
    title: 'SNIPER GRID',
    desc: 'Hard-hitting long-cycle turret profile for priority targets.',
  },
  {
    id: 'swarm_control',
    title: 'SWARM CONTROL',
    desc: 'Faster fighter cadence and stronger mine denial.',
  },
  {
    id: 'scavenger',
    title: 'SCAVENGER',
    desc: 'Extra salvage drones and higher wreck recovery yield.',
  },
];

export default function DefensePrepScreen({
  territory,
  defaultDoctrine = 'fortress',
  enemyCounterStyle = 'balanced',
  onBack,
  onStartDefense,
}) {
  const [selected, setSelected] = useState(defaultDoctrine);
  const threatText = useMemo(() => {
    const threat = Math.max(0, Math.min(10, Number(territory?.threat || 0)));
    return threat.toFixed(1);
  }, [territory?.threat]);

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.container}>
        <Text style={S.title}>STATION PREP</Text>
        <Text style={S.sub}>
          {territory?.galaxyId?.toUpperCase() || 'UNKNOWN'}-{territory?.systemNumber || '?'} | THREAT {threatText}
        </Text>
        <Text style={S.counter}>ENEMY ADAPTATION: {String(enemyCounterStyle).toUpperCase()}</Text>

        <View style={S.cardWrap}>
          {DEFENSE_DOCTRINES.map((d) => {
            const active = d.id === selected;
            return (
              <TouchableOpacity
                key={d.id}
                style={[S.card, active && S.cardActive]}
                activeOpacity={0.8}
                onPress={() => setSelected(d.id)}
              >
                <Text style={[S.cardTitle, active && S.cardTitleActive]}>{d.title}</Text>
                <Text style={S.cardDesc}>{d.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={S.startBtn} activeOpacity={0.85} onPress={() => onStartDefense?.(selected)}>
          <Text style={S.startBtnText}>START DEFENSE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.backBtn} activeOpacity={0.8} onPress={onBack}>
          <Text style={S.backBtnText}>BACK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#05070F' },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 22 },
  title: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 2.4,
  },
  sub: {
    marginTop: 8,
    color: '#9FC4E4',
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  counter: {
    marginTop: 6,
    color: '#FFC13A',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.1,
  },
  cardWrap: { marginTop: 18, gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(128,173,209,0.4)',
    backgroundColor: 'rgba(10,16,28,0.9)',
    borderRadius: 8,
    padding: 14,
  },
  cardActive: {
    borderColor: '#67F3FF',
    backgroundColor: 'rgba(13,29,47,0.95)',
  },
  cardTitle: {
    color: '#DCEEFF',
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  cardTitleActive: { color: '#67F3FF' },
  cardDesc: {
    marginTop: 5,
    color: 'rgba(180,207,233,0.8)',
    fontFamily: 'Courier New',
    fontSize: 10,
    lineHeight: 14,
  },
  startBtn: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#44FF88',
    backgroundColor: 'rgba(68,255,136,0.12)',
    borderRadius: 6,
    alignItems: 'center',
    paddingVertical: 12,
  },
  startBtnText: {
    color: '#44FF88',
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 1.8,
  },
  backBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(165,188,214,0.5)',
    borderRadius: 6,
    alignItems: 'center',
    paddingVertical: 10,
  },
  backBtnText: {
    color: 'rgba(188,208,230,0.85)',
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 1.2,
  },
});
