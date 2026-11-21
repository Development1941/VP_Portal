# IPO Model Builder

Upload audited financials, set the issue and capacity plan, download a linked 3-statement Excel model.

## Upload audited financial statements

PDF with the Profit and Loss, Balance Sheet and Cash Flow Statement for the last 3 years. Text PDFs only; scanned images need OCR first. Reading happens in your browser and the file is not uploaded anywhere.

**Drop PDF here or click to choose** Multiple PDFs are read together

Figures in the PDF are in

Year order across the page

Year columns per statement

## Historical financials

Audited numbers, oldest year first. Blue cells are editable. Anything the reader could not find is marked and set to zero.

Company name

Last audited year (ending)

Reporting units

## IPO structure and projection drivers

Placeholders are pre-filled. Operating drivers default to the historical ratios.

### Issue

### Objects of the issue (share of net proceeds)

### Deployment schedule (share of each object spent per year)

### New capacity and revenue from IPO capex

### Operating drivers (existing business)

### Valuation

## Download Excel model

Every projected number is a live formula. Change any blue cell in Excel and the three statements, IPO utilisation and valuation update together.

IPO net proceeds*→*Capex deployed*→*New capacity*→*Utilisation x price*→*Incremental revenue*→*P&L, BS, CF*→*DCF and comps

### Inside the workbook

- **Cover** integrity checks, summary financials, valuation summary
- **Assumptions** drivers with historical ratios beside each input
- **IPO** issue calculations, objects, deployment schedule, unutilised proceeds tracker
- **Rev_Build** existing revenue plus capacity added from IPO capex
- **PnL, BS, CF** 3 audited years and 5 projected years, linked and balanced
- **DCF, Comps** FCFF valuation, implied multiples, placeholder peer table

Formulas calculate when the file opens in Excel. Peer data, price band and capacity inputs are placeholders until replaced.