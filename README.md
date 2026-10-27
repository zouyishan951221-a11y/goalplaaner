# 理財目標導航

以理財目標為核心的 PV / FV / PMT 試算網站：設定目標 → 診斷達成率 → 取得行動建議。
純靜態網站，`index.html` 就在最外層，不需建置步驟、不需後端或資料庫。

## 功能
- **目標分析**：退休、子女教育、購屋、緊急預備金、自訂目標；計算通膨後目標終值、預估終值、達標所需月投入（PMT）與報酬率，並附 Excel 公式
- **資產累積路徑圖**、情境壓力測試（報酬率 ±2%）、逐年明細表
- **行動建議**：提高 PMT、延長年期、一次補足 PV、報酬率需求與風險提醒
- **PV · FV · PMT 工具箱**：三個獨立計算器，PMT 支援「存錢達標」與「貸款攤還」
- **全部目標總覽**：多目標每月現金流檢查
- 使用者資料只存在各自瀏覽器的 localStorage，不會上傳

## 檔案結構
```
index.html          網站首頁
favicon.svg         分頁圖示
robots.txt
_headers            Cloudflare Pages 安全與快取標頭
assets/css/style.css
assets/js/app.js    試算引擎與畫面邏輯
README.md
.gitignore
```

## 部署
1. GitHub 新增儲存庫 → 點 **uploading an existing file** → 把資料夾**裡面**的全部檔案拖進去 → Commit
2. Cloudflare → Workers & Pages → Create → Pages → **Connect to Git** → 選這個儲存庫
3. 建置設定：Framework preset `None`、Build command 留空、Build output directory 留空（或填 `/`）
4. Save and Deploy，完成後網址為 `https://<專案名稱>.pages.dev`

之後在 GitHub 修改任何檔案，Cloudflare 都會自動重新部署。
本機預覽：直接用瀏覽器開啟 `index.html` 即可。

## 試算假設
月複利、期末投入，與 Excel `FV(rate/12, n*12, -PMT, -PV)` 一致。報酬率與通膨皆為假設值，本工具供規劃與教學參考，不構成個別投資建議。
