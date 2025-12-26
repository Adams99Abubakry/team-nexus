import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskContext {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  project_name?: string;
}

interface RequestBody {
  type: "summarize" | "suggest" | "improve" | "chat";
  tasks?: TaskContext[];
  task?: TaskContext;
  message?: string;
  projectContext?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: RequestBody = await req.json();
    const { type, tasks, task, message, projectContext } = body;

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "summarize":
        systemPrompt = `You are a productivity assistant that summarizes tasks concisely. 
Provide a brief, actionable summary highlighting:
- Key priorities and urgent items
- Overdue or at-risk tasks
- Suggested focus areas for today
Keep your response under 150 words and use bullet points.`;
        userPrompt = `Here are the tasks to summarize:\n${JSON.stringify(tasks, null, 2)}`;
        break;

      case "suggest":
        systemPrompt = `You are a task planning assistant. Based on the project context, suggest 3-5 actionable tasks.
Each suggestion should be specific, measurable, and relevant.
Format as a JSON array with: title, description, priority (low/medium/high/urgent), estimated_hours.`;
        userPrompt = `Project context: ${projectContext || "General project"}\nSuggest relevant tasks.`;
        break;

      case "improve":
        systemPrompt = `You are a task optimization assistant. Improve the given task by:
- Making the title clearer and more actionable
- Enhancing the description with specific steps
- Suggesting appropriate priority and timeline
Return as JSON: { title, description, priority, suggested_due_days }`;
        userPrompt = `Improve this task:\n${JSON.stringify(task, null, 2)}`;
        break;

      case "chat":
        systemPrompt = `You are Flowboard AI, a helpful productivity assistant for project management.
You help users:
- Create and organize tasks effectively
- Prioritize work and manage deadlines
- Break down large projects into manageable tasks
- Provide productivity tips and best practices

Be concise, friendly, and actionable. Keep responses under 200 words unless more detail is needed.`;
        userPrompt = message || "Hello!";
        break;

      default:
        throw new Error("Invalid request type");
    }

    console.log(`Processing ${type} request`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // For structured responses, try to parse JSON
    let result = content;
    if (type === "suggest" || type === "improve") {
      try {
        // Extract JSON from the response (handle markdown code blocks)
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        result = JSON.parse(jsonMatch[1] || content);
      } catch {
        // If parsing fails, return as text
        result = content;
      }
    }

    console.log(`${type} request completed successfully`);

    return new Response(
      JSON.stringify({ result, type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
