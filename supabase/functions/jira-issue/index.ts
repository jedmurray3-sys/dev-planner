const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type StatusCategory = 'new' | 'indeterminate' | 'done';

interface JiraEntry {
  statusName: string;
  statusCategory: StatusCategory;
  timeSpentSeconds: number;
  originalEstimateSeconds: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const JIRA_BASE  = Deno.env.get('JIRA_BASE')  ?? '';
  const JIRA_EMAIL = Deno.env.get('JIRA_EMAIL') ?? '';
  const JIRA_TOKEN = Deno.env.get('JIRA_TOKEN') ?? '';
  const auth = btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`);

  const { keys } = await req.json() as { keys: string[] };

  const result: Record<string, JiraEntry> = {};

  await Promise.all(keys.map(async (key: string) => {
    try {
      const res = await fetch(
        `${JIRA_BASE}/rest/api/3/issue/${encodeURIComponent(key)}?fields=status,timetracking`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      const fields = data.fields ?? {};
      const status = fields.status ?? {};
      const timetracking = fields.timetracking ?? {};
      result[key] = {
        statusName: status.name ?? key,
        statusCategory: (status.statusCategory?.key ?? 'new') as StatusCategory,
        timeSpentSeconds: timetracking.timeSpentSeconds ?? 0,
        originalEstimateSeconds: timetracking.originalEstimateSeconds ?? 0,
      };
    } catch {
      // omit key on error — never fail the whole batch
    }
  }));

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
