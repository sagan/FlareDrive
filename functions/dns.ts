// Used by CGI feature

interface DnsRecord {
  name: string; // Record name
  type: string; // Human-readable type ('SRV', 'CNAME', 'A', etc.)
  ttl: number; // Time to Live
  rawData: string; // The unparsed data string from the DNS server
  parsed: {
    ip?: string; // Present for A/AAAA/SRV
    target?: string; // Present for CNAME/SRV (trailing dot removed)
    priority?: number; // Present for SRV
    weight?: number; // Present for SRV
    port?: number; // Present for SRV
  };
  resolvedIps: string[]; // The final backend IPs crawled for this specific record
}

interface DnsResult {
  domain: string; // Original domain queried
  type: string; // Original type queried
  status: string; // DNS status (e.g., 'NOERROR')
  records: DnsRecord[];
  allFinalIps: string[]; // A convenient global list of all unique final IPs found

  // the first record parsed data
  ip?: string;
  target?: string;
  port?: number;
}

export async function dnsQuery(domain: string, type: string, failOk: boolean): Promise<DnsResult> {
  const baseUrl = "https://1.1.1.1/dns-query";

  // DNS Type mapper (expandable if you need TXT, MX, etc.)
  const typeMap: Record<number, string> = { 1: "A", 5: "CNAME", 28: "AAAA", 33: "SRV" };
  const statusMap: Record<number, string> = {
    0: "NOERROR",
    1: "FORMERR",
    2: "SERVFAIL",
    3: "NXDOMAIN",
    4: "NOTIMP",
    5: "REFUSED",
  };

  // Helper function to perform the fetch
  async function fetchDns(name: string, qType: string) {
    const url = `${baseUrl}?name=${encodeURIComponent(name)}&type=${qType}`;
    const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
    if (!res.ok) throw new Error(`DNS fetch failed: ${res.status}`);
    return res.json();
  }

  // Recursive resolver to chase targets down to their final IPs
  const ipCache = new Map<string, string[]>();
  async function deepResolveIps(target: string, visited = new Set<string>()): Promise<string[]> {
    if (visited.has(target)) return [];
    visited.add(target);
    if (ipCache.has(target)) return ipCache.get(target)!;

    const ips: string[] = [];
    try {
      // Query both A and AAAA in parallel for the target
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [aRes, aaaaRes] = (await Promise.all([fetchDns(target, "A"), fetchDns(target, "AAAA")])) as any;

      const answers = [...(aRes.Answer || []), ...(aaaaRes.Answer || [])];
      for (const ans of answers) {
        if (ans.type === 1 || ans.type === 28) {
          ips.push(ans.data);
        } else if (ans.type === 5) {
          const nextTarget = ans.data.replace(/\.$/, "");
          const deepIps = await deepResolveIps(nextTarget, visited);
          ips.push(...deepIps);
        }
      }
    } catch {
      // Swallowing sub-query failures gracefully so the main query doesn't crash
    }

    const uniqueIps = Array.from(new Set(ips));
    ipCache.set(target, uniqueIps);
    return uniqueIps;
  }

  // --- Main Execution ---
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawData: any = await fetchDns(domain, type);

    const result: DnsResult = {
      domain,
      type,
      status: statusMap[rawData.Status] || "UNKNOWN",
      records: [],
      allFinalIps: [],
    };

    if (!failOk && (result.status !== "NOERROR" || !rawData.Answer)) {
      throw new Error(`status=${result.status}, answer_empty=${!!rawData.Answer}`);
    }

    if (!rawData.Answer) {
      return result;
    }
    const globalIps = new Set<string>();

    for (const ans of rawData.Answer) {
      const recordType = typeMap[ans.type] || `TYPE${ans.type}`;
      const record: DnsRecord = {
        name: ans.name,
        type: recordType,
        ttl: ans.TTL,
        rawData: ans.data,
        parsed: {},
        resolvedIps: [],
      };

      // 1. Handle standard IP records (A / AAAA)
      if (ans.type === 1 || ans.type === 28) {
        record.parsed.ip = ans.data;
        record.resolvedIps.push(ans.data);
        globalIps.add(ans.data);
      }

      // 2. Handle CNAME records
      else if (ans.type === 5) {
        const target = ans.data.replace(/\.$/, "");
        record.parsed.target = target;

        const ips = await deepResolveIps(target);
        record.resolvedIps = ips;
        record.parsed.ip = ips[0] || "";
        ips.forEach((ip) => globalIps.add(ip));
      }

      // 3. Handle SRV records (Format: "Priority Weight Port Target.")
      else if (ans.type === 33) {
        const parts = ans.data.trim().split(/\s+/);
        if (parts.length >= 4) {
          const priority = parseInt(parts[0], 10);
          const weight = parseInt(parts[1], 10);
          const port = parseInt(parts[2], 10);
          const target = parts.slice(3).join(" ").replace(/\.$/, "");

          record.parsed = { priority, weight, port, target };

          const ips = await deepResolveIps(target);
          record.resolvedIps = ips;
          record.parsed.ip = ips[0] || "";
          ips.forEach((ip) => globalIps.add(ip));
        }
      }

      result.records.push(record);
      if (result.records.length === 1) {
        result.ip = record.parsed.ip;
        result.target = record.parsed.target;
        result.port = record.parsed.port;
      }
    }

    result.allFinalIps = Array.from(globalIps);
    return result;
  } catch (err: unknown) {
    if (failOk) {
      return {
        domain,
        type,
        status: "ERROR",
        records: [],
        allFinalIps: [],
      };
    }
    throw err;
  }
}
