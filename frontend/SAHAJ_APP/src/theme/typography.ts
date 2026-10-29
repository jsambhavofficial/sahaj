import { TextStyle } from 'react-native';

export const typography = {
  // Standard Coordinator typography
  h1: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.3,
  } as TextStyle,
  h2: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  } as TextStyle,
  h3: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,
  bodyMedium: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  } as TextStyle,
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  } as TextStyle,
  badge: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  } as TextStyle,

  // Senior-friendly accessible typography (Larger, higher contrast, generous line height)
  seniorGreeting: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
  } as TextStyle,
  seniorQuestion: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  } as TextStyle,
  seniorButton: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  } as TextStyle,
  seniorBody: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  } as TextStyle,
  seniorInput: {
    fontSize: 22,
    fontWeight: '700',
  } as TextStyle,
};
