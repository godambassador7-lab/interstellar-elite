// src/components/ShopScreen.js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function ShopScreen({ wave, score, offers, onBuy, onSkip }) {
  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>FIELD MARKET</Text>
      <Text style={styles.subtitle}>Wave {wave} cleared | Cash in score points for upgrades</Text>
      <Text style={styles.points}>AVAILABLE POINTS: {score.toLocaleString()}</Text>

      <View style={styles.cards}>
        {offers.map((offer) => {
          const price = offer.price ?? offer.cost;
          const affordable = score >= price;
          return (
            <View key={offer.id} style={styles.card}>
              <Text style={styles.cardCategory}>{offer.category.toUpperCase()}</Text>
              <Text style={styles.cardTitle}>{offer.title}</Text>
              <Text style={styles.cardDesc}>{offer.desc}</Text>
              <Text style={styles.cardCost}>COST {price.toLocaleString()}</Text>
              <TouchableOpacity
                style={[styles.buyBtn, !affordable && styles.buyBtnDisabled]}
                activeOpacity={affordable ? 0.85 : 1}
                disabled={!affordable}
                onPress={() => onBuy(offer.id)}
              >
                <Text style={[styles.buyBtnText, !affordable && styles.buyBtnTextDisabled]}>
                  {affordable ? 'REDEEM' : 'NOT ENOUGH'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.skipBtn} activeOpacity={0.8} onPress={onSkip}>
        <Text style={styles.skipBtnText}>SKIP MARKET</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,7,14,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    zIndex: 220,
  },
  title: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2.2,
  },
  subtitle: {
    marginTop: 8,
    color: 'rgba(198,218,242,0.8)',
    fontFamily: 'Courier New',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  points: {
    marginTop: 12,
    color: '#30FFB5',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.1,
  },
  cards: {
    width: '100%',
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    maxWidth: 120,
    minHeight: 220,
    borderWidth: 1,
    borderColor: 'rgba(103,243,255,0.42)',
    backgroundColor: 'rgba(10,16,29,0.92)',
    borderRadius: 6,
    padding: 10,
  },
  cardCategory: {
    color: 'rgba(127,242,255,0.75)',
    fontFamily: 'Courier New',
    fontSize: 8,
    letterSpacing: 1,
  },
  cardTitle: {
    marginTop: 6,
    color: '#E5F4FF',
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardDesc: {
    marginTop: 8,
    color: 'rgba(195,210,232,0.82)',
    fontFamily: 'Courier New',
    fontSize: 8,
    lineHeight: 12,
  },
  cardCost: {
    marginTop: 10,
    color: '#FFC13A',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.6,
  },
  buyBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#30FFB5',
    backgroundColor: 'rgba(48,255,181,0.14)',
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyBtnDisabled: {
    borderColor: 'rgba(108,122,148,0.6)',
    backgroundColor: 'rgba(70,80,98,0.25)',
  },
  buyBtnText: {
    color: '#30FFB5',
    fontFamily: 'Courier New',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  buyBtnTextDisabled: {
    color: 'rgba(150,162,184,0.78)',
  },
  skipBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(189,206,232,0.6)',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipBtnText: {
    color: 'rgba(210,224,246,0.86)',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
