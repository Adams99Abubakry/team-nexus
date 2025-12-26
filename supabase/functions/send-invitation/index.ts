import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  inviterName: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "FlowBoard <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }
  
  return res.json();
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, workspaceId, workspaceName, role, inviterName }: InvitationRequest = await req.json();

    console.log(`Sending invitation to ${email} for workspace ${workspaceName}`);

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from("team_invitations")
      .insert({
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        role,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      // If duplicate, fetch existing invitation
      if (inviteError.code === "23505") {
        const { data: existingInvite } = await supabase
          .from("team_invitations")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("email", email.toLowerCase())
          .single();
        
        if (existingInvite) {
          // Just resend the email
          const inviteUrl = `${req.headers.get("origin") || "https://flowboard.app"}/accept-invite?token=${existingInvite.token}`;
          await sendEmail(
            email,
            `You've been invited to join ${workspaceName}`,
            getEmailHtml(inviterName, workspaceName, role, inviteUrl)
          );
          return new Response(JSON.stringify({ success: true, invitation: existingInvite }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }
      throw inviteError;
    }

    const inviteUrl = `${req.headers.get("origin") || "https://flowboard.app"}/accept-invite?token=${invitation.token}`;

    await sendEmail(
      email,
      `You've been invited to join ${workspaceName}`,
      getEmailHtml(inviterName, workspaceName, role, inviteUrl)
    );

    console.log("Invitation sent successfully to:", email);

    return new Response(JSON.stringify({ success: true, invitation }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

function getEmailHtml(inviterName: string, workspaceName: string, role: string, inviteUrl: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 24px; font-weight: bold;">F</span>
          </div>
        </div>
        
        <h1 style="color: #18181b; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
          You're Invited!
        </h1>
        
        <p style="color: #52525b; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">
          <strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> as a <strong>${role}</strong>.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        
        <p style="color: #a1a1aa; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
          This invitation will expire in 7 days.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
        
        <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;
}
