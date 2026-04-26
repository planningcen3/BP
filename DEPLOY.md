# Deploy เว็บไซต์ PEA Budget

โปรเจกต์นี้เป็น static site จึง deploy ได้โดยไม่ต้องมี backend server เพิ่ม ตัวเว็บอยู่ในโฟลเดอร์นี้และไฟล์เริ่มต้นคือ `index.html`

## วิธีที่แนะนำ: Cloudflare Pages

เหมาะถ้าต้องการลิงก์แชร์เร็วที่สุด และไม่ต้องตั้งค่า build command

1. เข้า Cloudflare Dashboard
2. ไปที่ `Workers & Pages`
3. เลือก `Create application`
4. เลือก `Pages`
5. เลือก `Direct Upload`
6. อัปโหลดทั้งโฟลเดอร์ `pea-budget-web`
7. ตั้งชื่อโปรเจกต์
8. Deploy

เมื่อเสร็จ จะได้ URL รูปแบบ `<project-name>.pages.dev`

อ้างอิง:
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## ทางเลือก: GitHub Pages

เหมาะถ้าอยากเก็บโค้ดไว้ใน repo แล้ว deploy ต่อเนื่องจาก Git

1. สร้าง GitHub repository
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์ `pea-budget-web`
3. ไปที่ `Settings > Pages`
4. เลือก source เป็น branch ที่เก็บไฟล์เว็บ
5. บันทึกการตั้งค่า

เว็บจะขึ้นที่ URL รูปแบบ `https://<owner>.github.io/<repository>`

อ้างอิง:
- [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## ทางเลือก: Netlify

เหมาะถ้าต้องการ drag-and-drop หรือผูกกับ Git ง่าย

1. เข้า Netlify
2. สร้างโปรเจกต์ใหม่
3. เลือก deploy แบบ drag-and-drop หรือเชื่อม Git
4. อัปโหลดโฟลเดอร์ `pea-budget-web`

อ้างอิง:
- [Netlify deploy overview](https://docs.netlify.com/deploy/deploy-overview/)
- [Netlify create deploys](https://docs.netlify.com/site-deploys/create-deploys/)

## หมายเหตุเรื่อง Google Sheet

ถ้าเว็บนี้จะใช้ส่งข้อมูลขึ้น Google Sheet ให้ตรวจว่า Apps Script ที่ deploy เป็น Web App ถูกตั้งสิทธิ์ให้ผู้ใช้งานกลุ่มเป้าหมายเข้าถึงได้ด้วย ไม่อย่างนั้นคนอื่นจะเปิดเว็บได้แต่บันทึกข้อมูลไม่ผ่าน
