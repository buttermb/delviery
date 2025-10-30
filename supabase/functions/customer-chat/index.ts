import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, message, mode } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get session and message history
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new Error('Session not found');
    }

    // If mode is human, just store the message and wait for admin
    if (mode === 'human' || session.mode === 'human') {
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        sender_type: 'user',
        message
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message sent to support team. They will respond shortly.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AI mode - get conversation history
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Build conversation history
    const conversationHistory = messages?.map(msg => ({
      role: msg.sender_type === 'user' ? 'user' : 'assistant',
      content: msg.message
    })) || [];

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a helpful customer support AI for Bud Dash, a premium delivery service in NYC. 

IMPORTANT - Provide SPECIFIC, ACTIONABLE help:

Order Status Questions:
- If user asks about delivery time or order status: "I can help you track your order! Please provide your tracking code (format: ABC-123-ABCD) or order number, and I'll show you exactly where your order is."
- Once they provide tracking code, respond: "Great! You can track your order in real-time here: https://yourdomain.com/track-order. Just enter your tracking code: [THEIR_CODE]. You'll see live updates on your delivery status, estimated arrival time, and courier location."
- For "when will my order arrive": Ask for their tracking code first, then direct to tracking page

Common Questions - Give Direct Answers:
- Delivery areas: "We deliver across all 5 NYC boroughs - Manhattan, Brooklyn, Queens, Bronx, and Staten Island"
- Delivery time: "Same-day delivery available! Orders placed before 8 PM typically arrive within 2-4 hours"
- Payment: "We accept cash on delivery and digital payments (Venmo, CashApp, Zelle)"
- Age verification: "You must be 21+ with valid ID. Our courier will verify on delivery"
- Minimum order: "No minimum order required"
- First-time discount: "New customers get 15% off! Use code FIRST15 at checkout"

Product Questions:
- Available products: flower, concentrates (shatter, wax, live resin), edibles (gummies, chocolates), vapes, pre-rolls
- Quality: "All products are lab-tested and sourced from premium suppliers"
- Pricing: "Visit our menu at https://yourdomain.com to see current pricing and availability"

Order Issues:
- Wrong/missing items: "I'll connect you with our support team right away to resolve this"
- Delivery delay: Ask for tracking code, then escalate to human support
- Quality concerns: Escalate to human support immediately

Be helpful and specific - avoid vague responses. If you don't have exact information, direct them to the right page or connect to human support.

If you can't help or the user seems frustrated, say: "Let me connect you with our support team right away. They'll help you immediately! 👨‍💼"`
          },
          ...conversationHistory,
          { role: 'user', content: message }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message.content;

    // Store both messages
    await supabase.from('chat_messages').insert([
      {
        session_id: sessionId,
        sender_type: 'user',
        message
      },
      {
        session_id: sessionId,
        sender_type: 'ai',
        message: aiMessage
      }
    ]);

    return new Response(
      JSON.stringify({ success: true, message: aiMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in customer-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});