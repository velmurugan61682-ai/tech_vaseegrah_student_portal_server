const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.generatePDF = (receipt) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const receiptsDir = path.join(__dirname, '..', 'uploads', 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }
      
      const filename = `receipt_${receipt.receiptNumber}.pdf`;
      const filePath = path.join(receiptsDir, filename);
      const writeStream = fs.createWriteStream(filePath);
      
      doc.pipe(writeStream);
      
      // Draw Border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('rgba(99, 102, 241, 0.2)');
      
      // Brand Title Header
      doc.fontSize(22)
         .fillColor('#4f46e5')
         .font('Helvetica-Bold')
         .text('TECH VASEEGRAH', { align: 'center' });
      
      doc.fontSize(9)
         .fillColor('#7c3aed')
         .font('Helvetica-Oblique')
         .text('Transforming Small Businesses into Smart Businesses', { align: 'center' });
      
      doc.fontSize(9)
         .fillColor('#4b5563')
         .font('Helvetica')
         .text('Thanjavur, Tamil Nadu, India', { align: 'center' });
      
      doc.moveDown(1.2);
      doc.strokeColor('rgba(99, 102, 241, 0.25)').lineWidth(1).moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.8);
      
      // Metadata Details Grid
      const initialY = doc.y;
      
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica');
      doc.text('RECEIPT NUMBER:', 40, initialY);
      doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold');
      doc.text(receipt.receiptNumber, 40, initialY + 12);
      
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica');
      doc.text('PAYMENT DATE:', 220, initialY);
      doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold');
      doc.text(new Date(receipt.paymentDate).toLocaleDateString(), 220, initialY + 12);
      
      // enrollment ID or student DB reference substring
      const enrollId = receipt.studentId?._id?.toString() || receipt.studentId?.toString() || '';
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica');
      doc.text('ENROLLMENT ID:', 400, initialY);
      doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold');
      doc.text(enrollId ? `TV-${enrollId.substring(18).toUpperCase()}` : 'N/A', 400, initialY + 12);
      
      doc.moveDown(2.2);
      const currentY = doc.y;
      
      doc.strokeColor('rgba(99, 102, 241, 0.15)').moveTo(40, currentY).lineTo(doc.page.width - 40, currentY).stroke();
      doc.moveDown(0.8);
      
      // Billing Details columns
      const billY = doc.y;
      doc.fontSize(9).fillColor('#4f46e5').font('Helvetica-Bold').text('BILLED TO:', 40, billY);
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(receipt.studentName, 40, billY + 14);
      doc.fontSize(8).fillColor('#4b5563').font('Helvetica');
      doc.text(`Email: ${receipt.email}`, 40, billY + 28);
      doc.text(`Phone: ${receipt.phone || 'N/A'}`, 40, billY + 40);
      
      doc.fontSize(9).fillColor('#4f46e5').font('Helvetica-Bold').text('INTERNSHIP PROGRAM:', 320, billY);
      doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold').text(receipt.courseName, 320, billY + 14);
      doc.fontSize(8).fillColor('#4b5563').font('Helvetica');
      doc.text(`Payment Mode: ${receipt.paymentMethod}`, 320, billY + 28);
      doc.text(`Reference Transaction ID: ${receipt.transactionId || 'N/A'}`, 320, billY + 40);
      
      doc.moveDown(4.5);
      const tableY = doc.y;
      
      // Table Header description
      doc.rect(40, tableY, doc.page.width - 80, 20).fill('#e0e7ff');
      doc.fontSize(8).fillColor('#312e81').font('Helvetica-Bold').text('DESCRIPTION', 50, tableY + 6);
      doc.text('FEES SUM', 300, tableY + 6, { width: 100, align: 'right' });
      doc.text('AMOUNT PAID', 450, tableY + 6, { width: 100, align: 'right' });
      
      doc.moveDown(0.8);
      const rowY = doc.y + 8;
      doc.fontSize(9).fillColor('#1f2937').font('Helvetica').text(`${receipt.courseName} Internship Program Enrollment Fees`, 50, rowY);
      doc.font('Helvetica-Bold').text(`₹${(receipt.amountPaid + receipt.balanceDue).toLocaleString()}`, 300, rowY, { width: 100, align: 'right' });
      doc.fillColor('#10b981').text(`₹${receipt.amountPaid.toLocaleString()}`, 450, rowY, { width: 100, align: 'right' });
      
      doc.moveDown(2);
      const footerY = doc.y + 12;
      doc.strokeColor('rgba(99, 102, 241, 0.25)').moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).stroke();
      
      // Balance Due / Totals
      const sumY = footerY + 12;
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text('Subtotal:', 340, sumY);
      doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold').text(`₹${(receipt.amountPaid + receipt.balanceDue).toLocaleString()}`, 450, sumY, { width: 100, align: 'right' });
      
      doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text('Total Paid:', 340, sumY + 14);
      doc.fontSize(9).fillColor('#10b981').font('Helvetica-Bold').text(`₹${receipt.amountPaid.toLocaleString()}`, 450, sumY + 14, { width: 100, align: 'right' });
      
      doc.fontSize(8).fillColor('#ef4444').font('Helvetica-Bold').text('Balance Due:', 340, sumY + 28);
      doc.fontSize(10).fillColor('#ef4444').font('Helvetica-Bold').text(`₹${receipt.balanceDue.toLocaleString()}`, 450, sumY + 28, { width: 100, align: 'right' });
      
      // Approved Badge stamp
      const stampY = sumY;
      doc.rect(40, stampY, 130, 50).stroke('rgba(16, 185, 129, 0.4)');
      doc.fontSize(10).fillColor('#10b981').font('Helvetica-Bold').text('APPROVED', 45, stampY + 8, { align: 'center', width: 120 });
      doc.fontSize(7).fillColor('#059669').font('Helvetica-Oblique').text('Tech Vaseegrah Accounts', 45, stampY + 22, { align: 'center', width: 120 });
      doc.fontSize(7).fillColor('#6b7280').font('Helvetica').text(`Status: ${receipt.paymentStatus}`, 45, stampY + 34, { align: 'center', width: 120 });
      
      // QR verification code block
      doc.rect(190, stampY, 50, 50).stroke('rgba(99, 102, 241, 0.4)');
      doc.fontSize(6).fillColor('#4f46e5').font('Helvetica').text('SECURE VERIFY', 190, stampY + 4, { align: 'center', width: 50 });
      let barX = 196;
      doc.lineWidth(1.5).strokeColor('#111827');
      for (let k = 0; k < 6; k++) {
        doc.moveTo(barX, stampY + 12).lineTo(barX, stampY + 38).stroke();
        barX += 6;
      }
      doc.fontSize(5).fillColor('#6b7280').text('VALID SIGNATURE', 190, stampY + 41, { align: 'center', width: 50 });
      
      // Bottom footer information
      doc.fontSize(7)
         .fillColor('#9ca3af')
         .font('Helvetica')
         .text('This transaction receipt is verified and certified by Tech Vaseegrah Accounts Division, Thanjavur, Tamil Nadu. For questions regarding the audit ledger, contact accounts@techvaseegrah.com.', 40, doc.page.height - 65, { align: 'center', width: doc.page.width - 80 });
      
      doc.end();
      
      writeStream.on('finish', () => {
        resolve(`/uploads/receipts/${filename}`);
      });
      
      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};
