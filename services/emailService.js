const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const createTransporter = async () => {
  // If production SMTP configs are defined
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Development fallback using auto-generated Ethereal test account
    console.log('⚠️ SMTP environment variables missing. Generating Ethereal test email account...');
    const testAccount = await nodemailer.createTestAccount().catch(err => {
      console.warn('⚠️ Ethereal account generation failed, mocking transporter.');
      return { user: 'mock', pass: 'mock' };
    });
    
    if (testAccount.user === 'mock') {
      return {
        sendMail: async (options) => {
          console.log(`[SMTP Mock] Pretending to send email to ${options.to}. Subject: ${options.subject}`);
          return { messageId: 'mock-id-' + Date.now() };
        }
      };
    }
    
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }
};

exports.sendEmailWithAttachment = async ({ to, subject, html, attachmentPath, filename }) => {
  try {
    const transporter = await createTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_USER ? `"Tech Vaseegrah Receipts" <${process.env.SMTP_USER}>` : '"Tech Vaseegrah Internship" <receipts@techvaseegrah.com>',
      to,
      subject,
      html,
    };
    
    if (attachmentPath && fs.existsSync(attachmentPath)) {
      mailOptions.attachments = [
        {
          filename: filename || path.basename(attachmentPath),
          path: attachmentPath
        }
      ];
    }
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email dispatched successfully: ${info.messageId}`);
    
    // Output test message preview link if Ethereal
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    if (previewUrl) {
      console.log(`🔗 Ethereal Email Preview Link: ${previewUrl}`);
    }
    
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error('❌ Nodemailer Email Dispatch Error:', error);
    throw error;
  }
};
