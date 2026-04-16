import { describe, it, expect } from 'vitest'
import { parseBuildNumber, compareBuildNumbers } from '../main/services/connector.js'

describe('parseBuildNumber', () => {
  it('extracts number from full build id', () => {
    expect(parseBuildNumber('7290-abcd1234')).toBe(7290)
  })

  it('extracts number from plain build number string', () => {
    expect(parseBuildNumber('7295')).toBe(7295)
  })

  it('returns null for null input', () => {
    expect(parseBuildNumber(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(parseBuildNumber(undefined)).toBeNull()
  })

  it('returns null for non-numeric string', () => {
    expect(parseBuildNumber('abcdef')).toBeNull()
  })

  it('handles numeric input directly', () => {
    expect(parseBuildNumber(7300)).toBe(7300)
  })
})

describe('compareBuildNumbers', () => {
  it('returns positive when remote is newer', () => {
    expect(compareBuildNumbers('7290-abc', '7295-def')).toBe(5)
  })

  it('returns zero when builds are the same', () => {
    expect(compareBuildNumbers('7295-abc', '7295-def')).toBe(0)
  })

  it('returns negative when local is ahead of remote', () => {
    expect(compareBuildNumbers('7295-abc', '7290-def')).toBe(-5)
  })

  it('returns null when local build is null', () => {
    expect(compareBuildNumbers(null, '7295')).toBeNull()
  })

  it('returns null when remote build is null', () => {
    expect(compareBuildNumbers('7290', null)).toBeNull()
  })
})
