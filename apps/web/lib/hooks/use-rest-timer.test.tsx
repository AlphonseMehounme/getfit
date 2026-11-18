// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRestTimer } from './use-rest-timer';

const KEY = 'getfit.rest.s-1';
const at = new Date('2026-11-23T07:10:00Z');

beforeEach(() => window.localStorage.clear());

describe('useRestTimer', () => {
  it('D39: starts from a set, extends by 15 s, and clears', () => {
    const { result } = renderHook(() => useRestTimer('s-1'));
    expect(result.current.rest).toBeNull();
    // +15 s with no rest running does nothing.
    act(() => result.current.extend(at));
    expect(result.current.rest).toBeNull();

    act(() => result.current.start(90, at));
    expect(result.current.rest).toEqual({ endsAt: new Date('2026-11-23T07:11:30Z'), totalS: 90 });
    act(() => result.current.extend(at));
    expect(result.current.rest).toEqual({ endsAt: new Date('2026-11-23T07:11:45Z'), totalS: 105 });
    act(() => result.current.clear());
    expect(result.current.rest).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('D48: the server render never has a rest, so hydration matches', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ endsAt: new Date(Date.now() + 60_000).toISOString(), totalS: 60 }),
    );
    function Probe() {
      return <p>{useRestTimer('s-1').rest ? 'resting' : 'none'}</p>;
    }
    expect(renderToString(<Probe />)).toContain('none');
  });
});
