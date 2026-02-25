function doGet(e) {
  Logger.log('=== パラメータ確認 ===');
  Logger.log('eオブジェクト: ' + JSON.stringify(e));
  Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
  
  const role = e && e.parameter ? e.parameter.role : null;
  Logger.log('role: ' + role);
  
  let responseData = [];

  try {
    const SPREADSHEET_ID = '1wAfgpOuhMXWciuxr7aKCEHtI6qNbFbRE2CSzytFMr4M';
    const SHEET_NAME = 'マスターデータ';
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`シート "${SHEET_NAME}" が見つかりません`);
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      throw new Error('データが存在しません');
    }
    
    const headers = data[0];
    Logger.log('ヘッダー行: ' + JSON.stringify(headers));
    
    const getColumnIndex = (headerName) => {
      const index = headers.indexOf(headerName);
      return index !== -1 ? index : null;
    };
    
    const colIndexes = {
      licensePlate:   getColumnIndex('自動車ナンバー'),
      carModel:          getColumnIndex('車種'),
      chassisNumber:  getColumnIndex('車台番号'),      // ★ 車台番号
      owner:          getColumnIndex('所有者'),        // ★ 所有者
      user:           getColumnIndex('使用者'),        // ★ 使用者（新規追加）
      status:         getColumnIndex('状態'),
      inspection:     getColumnIndex('車検満了日'),
      insurance:      getColumnIndex('任意保険'),
      area:           getColumnIndex('貸出先/エリア'),
      price:          getColumnIndex('レンタル料金（例：15000）'),
      imageFolderId:  getColumnIndex('車両画像')
    };
    
    Logger.log('列インデックス: ' + JSON.stringify(colIndexes));
    
    const vehicles = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row[colIndexes.licensePlate]) continue;
      
      const formatDate = (dateValue) => {
        if (!dateValue) return '';
        if (dateValue instanceof Date) {
          return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
        return dateValue.toString();
      };
      
      const imageFolderId = row[colIndexes.imageFolderId];
      Logger.log(`行${i+1}: 車両画像列の値 = ${imageFolderId}`);
      
      const images = getImagesFromFolder(imageFolderId);
      
      // ★ 価格は数値のまま渡す（フォーマットはHTML側で「〇円/月」に変換）
      const rawPrice = colIndexes.price !== null ? row[colIndexes.price] : '';
      
      vehicles.push({
        id:            i,
        plateNumber:   row[colIndexes.licensePlate]  || '',
        carModel:         row[colIndexes.carModel]         || '',
        chassisNumber: colIndexes.chassisNumber !== null ? (row[colIndexes.chassisNumber] || '') : '',
        owner:         colIndexes.owner !== null     ? (row[colIndexes.owner]         || '') : '',
        user:          colIndexes.user !== null      ? (row[colIndexes.user]          || '') : '', // ★ 使用者
        status:        row[colIndexes.status]        || '',
        inspection:    formatDate(row[colIndexes.inspection]),
        insurance:     formatDate(row[colIndexes.insurance]),
        area:          row[colIndexes.area]          || '',
        price:         rawPrice,   // ★ 数値のまま返す
        images:        images
      });
    }

    Logger.log('車両データ数: ' + vehicles.length);

    if (!role || role === 'employee') {
      responseData = vehicles;
      Logger.log('社員用データを返します');
      
    } else if (role === 'client') {
      responseData = vehicles.map(car => {
        let clientStatus = '貸出不可';
        if (car.status === '販売可') {
          clientStatus = '貸出可';
        }
        return {
          id:         car.id,
          carModel:   car.carModel,
          price:      car.price,
          area:       car.area,
          status:     clientStatus,
          images:     car.images,
          inspection: car.inspection
        };
      });
      Logger.log('顧客用データを返します');
    } else {
      Logger.log('不明なrole: ' + role + ' - 社員用データを返します');
      responseData = vehicles;
    }

    Logger.log('返却データ件数: ' + responseData.length);

  } catch (error) {
    Logger.log('エラー発生: ' + error.message);
    Logger.log('スタックトレース: ' + error.stack);
    
    // エラー時はダミーデータ
    const dummyData = [
      { 
        id:            1, 
        plateNumber:   '品川 500 あ 1234', 
        carModel:         'トヨタ アルファード',
        chassisNumber: 'ZH30-0012345',
        owner:         'TASK',
        user:          '山田 太郎',
        status:        '販売可',
        inspection:    '2025-12-15', 
        insurance:     '2026-03-20', 
        area:          '大阪', 
        price:         15000,   // ★ 数値
        images:        ['https://placehold.co/400x300/e5e7eb/6b7280?text=Alphard']
      }
    ];

    if (role === 'client') {
      responseData = dummyData.map(car => ({
        id:         car.id,
        carModel:   car.carModel,
        price:      car.price,
        area:       car.area,
        status:     car.status === '販売可' ? '貸出可' : '貸出不可',
        images:     car.images,
        inspection: car.inspection
      }));
    } else {
      responseData = dummyData;
    }
  }

  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(responseData));

  return output;
}

function getImagesFromFolder(folderId) {
  if (!folderId) {
    Logger.log('  フォルダIDが空です');
    return ['https://placehold.co/400x300/e5e7eb/6b7280?text=No+Image'];
  }
  
  try {
    Logger.log('  フォルダID取得試行: ' + folderId);
    const folder = DriveApp.getFolderById(folderId);
    Logger.log('  フォルダ名: ' + folder.getName());
    
    const files = folder.getFiles();
    const imageUrls = [];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName().toLowerCase();
      const isImage = imageExtensions.some(ext => fileName.endsWith('.' + ext));
      
      if (isImage) {
        const fileId = file.getId();
        imageUrls.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`);
        Logger.log('  画像追加: ' + fileName);
      }
    }
    
    Logger.log('  取得した画像数: ' + imageUrls.length);
    
    if (imageUrls.length === 0) {
      return ['https://placehold.co/400x300/e5e7eb/6b7280?text=No+Image'];
    }
    
    return imageUrls;
    
  } catch (error) {
    Logger.log('  画像取得エラー: ' + error.message);
    return ['https://placehold.co/400x300/e5e7eb/6b7280?text=Error'];
  }
}
