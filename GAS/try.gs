function getAllSheetsData() {
  // アクティブなスプレッドシートを取得
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // すべてのシートを取得
  const sheets = ss.getSheets();
  
  // データを格納するオブジェクト
  let allData = {};

  // 各シートをループ処理
  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    
    // シート上のデータがある範囲を自動判別して値を取得 (2次元配列)
    // データがない場合は空配列になります
    const values = sheet.getDataRange().getValues();
    
    // オブジェクトに格納 { "シート名": [[行1], [行2]...] }
    allData[sheetName] = values;
  });

  // --- 確認用ログ出力 ---
  // 実行ログで確認したい場合は以下を使用
  console.log(allData);
  
  return allData;
}
