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

    console.log(`Creating invitation for ${email} to workspace ${workspaceName}`);

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
          const inviteUrl = `${req.headers.get("origin") || "https://flowboard.app"}/accept-invite?token=${existingInvite.token}`;
          
          // Try to send email, but don't fail if it doesn't work
          let emailSent = false;
          if (RESEND_API_KEY) {
            try {
              await sendEmail(
                email,
                `You've been invited to join ${workspaceName}`,
                getEmailHtml(inviterName, workspaceName, role, inviteUrl)
              );
              emailSent = true;
            } catch (emailError) {
              console.log("Email sending failed (optional):", emailError);
            }
          }
          
          return new Response(JSON.stringify({ 
            success: true, 
            invitation: existingInvite,
            inviteUrl,
            emailSent
          }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }
      throw inviteError;
    }

    const inviteUrl = `${req.headers.get("origin") || "https://flowboard.app"}/accept-invite?token=${invitation.token}`;

    // Try to send email, but don't fail if it doesn't work
    let emailSent = false;
    if (RESEND_API_KEY) {
      try {
        await sendEmail(
          email,
          `You've been invited to join ${workspaceName}`,
          getEmailHtml(inviterName, workspaceName, role, inviteUrl)
        );
        emailSent = true;
        console.log("Invitation email sent successfully to:", email);
      } catch (emailError) {
        console.log("Email sending failed (optional):", emailError);
      }
    }

    console.log("Invitation created successfully for:", email);

    return new Response(JSON.stringify({ 
      success: true, 
      invitation,
      inviteUrl,
      emailSent
    }), {
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
      <title>FlowBoard Invitation</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%); margin: 0; padding: 60px 20px; min-height: 100vh;">
      <div style="max-width: 520px; margin: 0 auto;">
        <!-- Logo Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; gap: 12px;">
            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span style="font-size: 28px; font-weight: 700; color: white; letter-spacing: -0.5px;">FlowBoard</span>
          </div>
        </div>

        <!-- Main Card -->
        <div style="background: rgba(255, 255, 255, 0.95); border-radius: 24px; padding: 48px 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
          
          <!-- Decorative Element -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-flex; width: 72px; height: 72px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 50%; align-items: center; justify-content: center;">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 4L12 14.01l-3-3" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <h1 style="color: #0f172a; font-size: 28px; font-weight: 700; text-align: center; margin: 0 0 12px 0; letter-spacing: -0.5px;">
            You're Invited! 🎉
          </h1>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.7; text-align: center; margin: 0 0 32px 0;">
            <strong style="color: #0f172a;">${inviterName}</strong> has invited you to join the team on FlowBoard.
          </p>

          <!-- Workspace Card -->
          <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; padding: 24px; margin-bottom: 32px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: white;">
                ${workspaceName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">${workspaceName}</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Role: <span style="color: #6366f1; font-weight: 600; text-transform: capitalize;">${role}</span></p>
              </div>
            </div>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4); transition: all 0.2s;">
              Accept Invitation →
            </a>
          </div>
          
          <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 24px 0 0 0;">
            ⏰ This invitation expires in 7 days
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px;">
          <p style="color: rgba(255, 255, 255, 0.6); font-size: 13px; margin: 0 0 8px 0;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} FlowBoard. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
