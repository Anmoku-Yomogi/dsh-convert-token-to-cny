/**
 * Token cost in CNY, added to the conversation's bottom information bar.
 *
 * The plugin owns one extra entry in `conversation.composer.dock` (the row
 * under the composer that already hosts the shipped activity and token-usage
 * pills). It reads the durable session projections instead of scanning events:
 *
 * - `tokenUsage`     — whole-log uncached / cached / output token totals.
 * - `modelSelection` — the provider/model the last request actually used.
 *
 * Nothing shipped is replaced or hidden: the entry only appends a pill after
 * the existing information, so the original usage display stays intact.
 *
 * Prices are DeepSeek's published CNY list prices per 1,000,000 tokens
 * (2026-11). Peak hours are Beijing time Monday–Friday 09:00–12:00 and
 * 14:00–18:00, excluding Chinese public holidays; every other moment is
 * idle time at half price.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-token-cost',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'token-cost';

    /* ------------------------------------------------------------------ */
    /* Prices                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * CNY per 1,000,000 tokens, as `[idle, peak]` (peak = list price).
     * Keep in sync with https://api-docs.deepseek.com/zh-cn/quick_start/pricing
     */
    const PRICES = {
      'deepseek-flash': {
        cacheRead: [0.02, 0.04],
        cacheMiss: [1, 2],
        output: [4, 8],
      },
      'deepseek-v4-pro': {
        cacheRead: [0.15, 0.3],
        cacheMiss: [4.5, 9],
        output: [13.5, 27],
      },
    };

    /** Used when the session reports no model, or one without a price row. */
    const FALLBACK_MODEL = 'deepseek-flash';

    /* ------------------------------------------------------------------ */
    /* Peak / idle windows (Beijing time)                                 */
    /* ------------------------------------------------------------------ */

    const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

    /** Comparable Chinese public holidays (inclusive date ranges). */
    const HOLIDAYS = [
      ['2026-01-01', '2026-01-03'],
      ['2026-02-15', '2026-02-23'],
      ['2026-04-04', '2026-04-06'],
      ['2026-05-01', '2026-05-05'],
      ['2026-06-19', '2026-06-21'],
      ['2026-09-25', '2026-09-27'],
      ['2026-10-01', '2026-10-07'],
      ['2027-01-01', '2027-01-03'],
      ['2027-02-05', '2027-02-13'],
      ['2027-04-03', '2027-04-05'],
      ['2027-04-30', '2027-05-04'],
      ['2027-06-09', '2027-06-09'],
      ['2027-09-15', '2027-09-15'],
      ['2027-10-01', '2027-10-07'],
    ];

    function pad2(value) {
      return value < 10 ? '0' + value : String(value);
    }

    function beijingClock(nowMs) {
      const d = new Date(nowMs + BEIJING_OFFSET_MS);
      return {
        date:
          d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()),
        weekday: d.getUTCDay(),
        minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
      };
    }

    function isHoliday(date) {
      for (const [start, end] of HOLIDAYS) {
        if (date >= start && date <= end) return true;
      }
      return false;
    }

    /** True while DeepSeek bills the peak (list) price. */
    function isPeak(nowMs) {
      const clock = beijingClock(nowMs);
      if (clock.weekday === 0 || clock.weekday === 6) return false;
      if (isHoliday(clock.date)) return false;
      return (
        (clock.minutes >= 9 * 60 && clock.minutes < 12 * 60) ||
        (clock.minutes >= 14 * 60 && clock.minutes < 18 * 60)
      );
    }

    /* ------------------------------------------------------------------ */
    /* Formatting                                                         */
    /* ------------------------------------------------------------------ */

    function groupDigits(value) {
      return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatYuan(value) {
      if (!(value > 0)) return '￥0';
      if (value < 0.01) return '￥' + value.toFixed(4);
      if (value < 1) return '￥' + value.toFixed(3);
      if (value < 100) return '￥' + value.toFixed(2);
      return '￥' + value.toFixed(1);
    }

    /** A price such as 0.02 / 2 / 13.5 without trailing zero noise. */
    function formatPrice(value) {
      return String(value);
    }

    /* ------------------------------------------------------------------ */
    /* Cost                                                               */
    /* ------------------------------------------------------------------ */

    function priceFor(model) {
      if (model && PRICES[model] !== undefined) return { model: model, prices: PRICES[model] };
      return { model: FALLBACK_MODEL, prices: PRICES[FALLBACK_MODEL] };
    }

    /**
     * Fold the four disjoint billing buckets into CNY.
     * Cache writes are billed at the cache-miss input price by DeepSeek.
     */
    function estimate(usage, prices, peak) {
      const slot = peak ? 1 : 0;
      const cacheMiss = usage.uncachedInputTokens + usage.cacheWriteTokens;
      const cost =
        (cacheMiss * prices.cacheMiss[slot] +
          usage.cacheReadTokens * prices.cacheRead[slot] +
          usage.outputTokens * prices.output[slot]) /
        1e6;
      return {
        cacheMiss: cacheMiss,
        cost: cost,
        tokens: cacheMiss + usage.cacheReadTokens + usage.outputTokens,
      };
    }

    /* ------------------------------------------------------------------ */
    /* Locale                                                             */
    /* ------------------------------------------------------------------ */

    const EN = {
      'cost.label': '≈{amount}',
      'cost.heading': 'Estimated spend {amount}',
      'cost.miss': 'input (cache miss) {tokens}',
      'cost.hit': 'cached input {tokens}',
      'cost.output': 'output {tokens}',
      'cost.rates': 'rate ￥{miss} / ￥{hit} / ￥{output} per 1M tokens',
      'cost.period': '{period} rates',
      'cost.peak': 'peak-hour',
      'cost.idle': 'off-peak',
      'cost.model': 'DeepSeek {model} prices',
      'cost.estimate': 'estimate from durable token totals',
    };

    const ZH = {
      'cost.label': '≈{amount}',
      'cost.heading': '本对话估算花费 {amount}',
      'cost.miss': '输入（缓存未命中）{tokens}',
      'cost.hit': '缓存读取 {tokens}',
      'cost.output': '输出 {tokens}',
      'cost.rates': '单价 ￥{miss} / ￥{hit} / ￥{output} 每百万 tokens',
      'cost.period': '按{period}价',
      'cost.peak': '峰时',
      'cost.idle': '谷时',
      'cost.model': 'DeepSeek {model} 价格',
      'cost.estimate': '按持久化 token 总量估算',
    };

    /* ------------------------------------------------------------------ */
    /* Styles                                                             */
    /* ------------------------------------------------------------------ */

    const CSS = `
.dsh-tc-anchor {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
}
.dsh-tc-pill {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  margin: 0;
  padding: 1px 8px;
  border: 0;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-variant-numeric: tabular-nums;
  line-height: inherit;
  white-space: nowrap;
}
.dsh-tc-pill:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}
.dsh-tc-pill svg {
  flex: none;
  width: 14px;
  height: 14px;
}
.dsh-tc-icon {
  display: block;
  width: 14px;
  height: 14px;
}
.dsh-tc-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;

    function CoinIcon() {
      return h(
        'svg',
        {
          className: 'dsh-tc-icon',
          viewBox: '0 0 14 14',
          width: 14,
          height: 14,
          focusable: false,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('circle', { cx: 7, cy: 7, r: 5.5 }),
        h('path', { d: 'M4.5 4.1 7 7.1l2.5-3' }),
        h('path', { d: 'M7 7.1v3' }),
        h('path', { d: 'M5.1 8.1h3.8M5.1 9.7h3.8' }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Component                                                          */
    /* ------------------------------------------------------------------ */

    function TokenCostPill({ useProjection, t }) {
      const usage = useProjection('tokenUsage');
      const selection = useProjection('modelSelection');
      const [peak, setPeak] = React.useState(() => isPeak(Date.now()));

      // Peak/idle switches twice a day; re-read it without re-rendering while
      // the window did not change.
      React.useEffect(() => {
        const timer = setInterval(() => {
          setPeak((previous) => {
            const next = isPeak(Date.now());
            return next === previous ? previous : next;
          });
        }, 30000);
        return () => clearInterval(timer);
      }, []);

      if (usage === undefined || usage === null) return null;
      const resolved = priceFor(selection === undefined || selection === null ? undefined : (selection.lastUsed || selection.next || {}).model);
      const priced = estimate(usage, resolved.prices, peak);
      if (priced.tokens === 0) return null;

      const amount = t('cost.label', { amount: formatYuan(priced.cost) });
      const words = [
        t('cost.heading', { amount: formatYuan(priced.cost) }),
        t('cost.miss', { tokens: groupDigits(priced.cacheMiss) }),
        t('cost.hit', { tokens: groupDigits(usage.cacheReadTokens) }),
        t('cost.output', { tokens: groupDigits(usage.outputTokens) }),
        t('cost.rates', {
          miss: formatPrice(resolved.prices.cacheMiss[peak ? 1 : 0]),
          hit: formatPrice(resolved.prices.cacheRead[peak ? 1 : 0]),
          output: formatPrice(resolved.prices.output[peak ? 1 : 0]),
        }),
        t('cost.period', { period: t(peak ? 'cost.peak' : 'cost.idle') }),
        t('cost.model', { model: resolved.model }),
        t('cost.estimate'),
      ].join(' · ');

      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        h(
          'span',
          { key: 'pill', className: 'dsh-tc-anchor', 'data-composer-stat': 'token-cost' },
          h('span', {
            className: 'dsh-tc-pill',
            role: 'img',
            'aria-label': words,
            title: words,
          }, h(CoinIcon), h('span', { className: 'dsh-tc-label' }, amount)),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                             */
    /* ------------------------------------------------------------------ */

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'token-cost:dictionaries');

      ctx.slots.inject('conversation.composer.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: 'token-cost',
            order: 2,
            locale: NS,
          },
          TokenCostPill,
        ),
      );
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
