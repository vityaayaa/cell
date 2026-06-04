import ExcelJS from 'exceljs'

export interface ProductAggregate {
  name: string
  timesOrdered: number
  avgOrdered: number
  avgTaken: number
  timesUnavailable: number
}

export async function exportAggregatesExcel(aggregates: ProductAggregate[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Товары')

  sheet.columns = [
    { header: 'Товар', key: 'name', width: 32 },
    { header: 'Раз в заявке', key: 'timesOrdered', width: 15 },
    { header: 'Среднее заказано (пачек)', key: 'avgOrdered', width: 26 },
    { header: 'Среднее взяли (пачек)', key: 'avgTaken', width: 23 },
    { header: 'Раз не было', key: 'timesUnavailable', width: 15 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  }

  aggregates.forEach((a) => {
    sheet.addRow({
      name: a.name,
      timesOrdered: a.timesOrdered,
      avgOrdered: Math.round(a.avgOrdered * 10) / 10,
      avgTaken: Math.round(a.avgTaken * 10) / 10,
      timesUnavailable: a.timesUnavailable,
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'cell-aggregates.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}
