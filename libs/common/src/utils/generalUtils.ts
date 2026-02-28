export const generalUtils = {
  async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },

  isUrl(data: any) {
    if (typeof data !== 'string') {
      return false;
    }

    const res = [
      'http://',
      'https://',
    ].some((v) => data.includes(v));

    return res;
  },

  normalizeUrl(input: string): string {
    try {
      const url = new URL(input.trim());

      url.pathname = url.pathname.replace(/\/+$/, '');
      url.hostname = url.hostname.toLowerCase();

      return url.toString();
    } catch {
      return '';
    }
  },

  isHttpRpc(url: string): boolean {
    const u = url.trim();
    if (!(u.startsWith('http://') || u.startsWith('https://'))) return false;

    // remove template variables
    if (
      u.includes('${')
      || u.includes('{')
      || u.includes('}')
      || u.includes('$%7B')
      || u.includes('%7B')
      || u.includes('%7D')
    ) return false;

    return true;
  },

  decimalsFromUnit(unit: bigint): number {
    // waiting for 1, 10, 100, 1e18...
    const s = unit.toString();

    if (s === '1') {
      return 0;
    }

    // unit = 1 followed by N zeros
    if (
      s.startsWith('1')
      && /^10+$/.test(s)
    ) {
      return s.length - 1;
    }

    // fallback
    return 18;
  },
};
