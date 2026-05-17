// TEMPMAIL - Titan V3.0 Ready
// Commanded by Lord Zayrou

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    
    // 1. Create email (with custom username support)
    if (path === '/api/temp/email' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const domain = body.domain || env.DOMAIN || 'tempmail.com';
      let username = body.username ? body.username.trim() : null;
      
      if (!username) {
        username = 'user_' + Math.random().toString(36).substring(2, 9);
      }
      
      const email = `${username}@${domain}`.toLowerCase();
      
      // Check if email exists
      const existing = await env.DB.prepare(
        `SELECT email FROM temp_emails WHERE email = ? AND expires_at > datetime('now')`
      ).bind(email).first();
      
      if (existing) {
        return new Response(JSON.stringify({ error: 'Email exists, try another username' }), { status: 409, headers });
      }
      
      await env.DB.prepare(
        `INSERT INTO temp_emails (email, domain, username, created_at, expires_at) 
         VALUES (?, ?, ?, datetime('now'), datetime('now', '+1 hour'))`
      ).bind(email, domain, username).run();
      
      return new Response(JSON.stringify({ email, username, expires_in: 3600 }), { headers });
    }
    
    // 2. Get messages by email
    if (path === '/api/messages' && request.method === 'GET') {
      const email = url.searchParams.get('email');
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers });
      }
      
      const messages = await env.DB.prepare(
        `SELECT id, from_email, subject, body, html_body, received_at, is_read 
         FROM messages 
         WHERE email = ? 
         ORDER BY received_at DESC LIMIT 50`
      ).bind(email.toLowerCase()).all();
      
      // Mark as read
      await env.DB.prepare(
        `UPDATE messages SET is_read = 1 WHERE email = ? AND is_read = 0`
      ).bind(email.toLowerCase()).run();
      
      return new Response(JSON.stringify(messages.results), { headers });
    }
    
    // 3. Get single message
    if (path.match(/^\/api\/message\/\d+$/) && request.method === 'GET') {
      const id = path.split('/').pop();
      const message = await env.DB.prepare(
        `SELECT * FROM messages WHERE id = ?`
      ).bind(id).first();
      
      return new Response(JSON.stringify(message), { headers });
    }
    
    // 4. Delete email
    if (path === '/api/email/delete' && request.method === 'DELETE') {
      const { email } = await request.json();
      await env.DB.prepare(`DELETE FROM messages WHERE email = ?`).bind(email.toLowerCase()).run();
      await env.DB.prepare(`DELETE FROM temp_emails WHERE email = ?`).bind(email.toLowerCase()).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }
    
    // 5. Get all active emails for a session
    if (path === '/api/emails' && request.method === 'GET') {
      const emails = await env.DB.prepare(
        `SELECT email, domain, username, created_at, expires_at 
         FROM temp_emails 
         WHERE expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 20`
      ).all();
      
      return new Response(JSON.stringify(emails.results), { headers });
    }
    
    // 6. Get numbers (dynamic from API or static)
    if (path === '/api/numbers' && request.method === 'GET') {
      // Fetch from external SMS service or return static
      const numbers = await env.DB.prepare(
        `SELECT number, country, service FROM available_numbers WHERE is_active = 1 LIMIT 30`
      ).all();
      
      if (numbers.results.length === 0) {
        // Fallback static numbers
        const fallback = [
          { number: '+12025550123', country: 'USA', service: 'twilio' },
          { number: '+442045012345', country: 'UK', service: 'twilio' },
          { number: '+4915112345678', country: 'Germany', service: 'twilio' }
        ];
        return new Response(JSON.stringify(fallback), { headers });
      }
      
      return new Response(JSON.stringify(numbers.results), { headers });
    }
    
    // 7. Get SMS for number
    if (path === '/api/sms' && request.method === 'GET') {
      const number = url.searchParams.get('number');
      const sms = await env.DB.prepare(
        `SELECT from_number, message, received_at, is_read 
         FROM incoming_sms 
         WHERE to_number = ? 
         ORDER BY received_at DESC LIMIT 50`
      ).bind(number).all();
      
      // Mark as read
      await env.DB.prepare(
        `UPDATE incoming_sms SET is_read = 1 WHERE to_number = ? AND is_read = 0`
      ).bind(number).run();
      
      return new Response(JSON.stringify(sms.results), { headers });
    }
    
    // 8. Webhook for SMS (Twilio, Vonage, etc.)
    if (path === '/api/webhook/sms' && request.method === 'POST') {
      const formData = await request.formData();
      const to = formData.get('To');
      const from = formData.get('From');
      const body = formData.get('Body');
      
      await env.DB.prepare(
        `INSERT INTO incoming_sms (to_number, from_number, message, received_at) 
         VALUES (?, ?, ?, datetime('now'))`
      ).bind(to, from, body).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }
    
    // 9. Webhook for Email (alternative to email event)
    if (path === '/api/webhook/email' && request.method === 'POST') {
      const { to, from, subject, body, html } = await request.json();
      
      await env.DB.prepare(
        `INSERT INTO messages (email, from_email, subject, body, html_body, received_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(to, from, subject, body, html).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }
    
    // 10. Check email health (for bot monitoring)
    if (path === '/api/health' && request.method === 'GET') {
      const activeCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM temp_emails WHERE expires_at > datetime('now')`
      ).first();
      
      const messageCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE received_at > datetime('now', '-1 hour')`
      ).first();
      
      return new Response(JSON.stringify({ 
        status: 'healthy', 
        active_emails: activeCount.count,
        recent_messages: messageCount.count,
        timestamp: new Date().toISOString()
      }), { headers });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  },
  
  // Email routing handler (receives real emails)
  async email(message, env, ctx) {
    const emailAddress = message.to.toLowerCase();
    
    // Check if email exists and not expired
    const activeEmail = await env.DB.prepare(
      `SELECT email FROM temp_emails WHERE email = ? AND expires_at > datetime('now')`
    ).bind(emailAddress).first();
    
    if (activeEmail) {
      // Parse email content
      let subject = message.headers.get('subject') || 'No Subject';
      let from = message.from || 'Unknown';
      let body = '';
      let htmlBody = '';
      
      // Extract text body
      if (message.plain) {
        body = await message.plain();
      } else if (message.html) {
        htmlBody = await message.html();
      } else {
        const raw = await new Response(message.raw).text();
        body = raw.substring(0, 5000);
      }
      
      // Store in database
      await env.DB.prepare(
        `INSERT INTO messages (email, from_email, subject, body, html_body, received_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(emailAddress, from, subject, body.substring(0, 5000), htmlBody).run();
      
      // Log for monitoring
      console.log(`📧 Email received: ${emailAddress} from ${from}`);
    } else {
      console.log(`⚠️ Email to expired/nonexistent address: ${emailAddress}`);
    }
  },
  
  // Scheduled cleanup
  async scheduled(event, env, ctx) {
    ctx.waitUntil(async () => {
      const deletedEmails = await env.DB.prepare(
        `DELETE FROM temp_emails WHERE expires_at < datetime('now')`
      ).run();
      
      const deletedMessages = await env.DB.prepare(
        `DELETE FROM messages WHERE email NOT IN (SELECT email FROM temp_emails)`
      ).run();
      
      const deletedSms = await env.DB.prepare(
        `DELETE FROM incoming_sms WHERE received_at < datetime('now', '-7 days')`
      ).run();
      
      console.log(`🧹 Cleanup: ${deletedEmails.meta.changes} emails, ${deletedMessages.meta.changes} messages, ${deletedSms.meta.changes} SMS`);
    });
  }
};