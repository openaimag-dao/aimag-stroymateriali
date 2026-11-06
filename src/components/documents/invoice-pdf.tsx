import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWordsKzt } from "@/lib/amount-in-words";
import { formatDocDate, type QuoteDoc } from "@/lib/documents";
import { siteConfig } from "@/config/site";
import { C, DocHeader, PageFooter, Signature, companyTitle, moneyText, qtyText, s } from "./pdf-base";

// № · Наименование · Кол-во · Ед. · Цена · Сумма
const W = { n: "6%", name: "48%", qty: "11%", unit: "7%", price: "13%", sum: "15%" };

function Req({ label, value, width }: { label: string; value: string; width: string }) {
  return (
    <View style={{ width, padding: 6, borderRightWidth: 1, borderRightColor: C.line }}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.strong, { marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

export function InvoicePdf({ doc }: { doc: QuoteDoc }) {
  const order = doc.order!;
  const seller = doc.seller;
  const date = formatDocDate(order.created_at);

  return (
    <Document title={`Счёт на оплату ${order.invoice_number}`} author={seller.name} language="ru">
      <Page size="A4" style={s.page}>
        <DocHeader seller={seller} />
        <View style={s.body}>
          <Text style={{ fontSize: 8, color: C.muted }}>
            Внимание! Оплата данного счёта означает согласие с условиями поставки товара. Товар отпускается по факту поступления
            денег на расчётный счёт поставщика.
          </Text>

          <View style={s.table}>
            <View style={{ flexDirection: "row" }}>
              <Req label="Бенефициар" value={`${seller.name}, БИН ${seller.bin}`} width="50%" />
              <Req label="ИИК" value={seller.iban ?? "—"} width="35%" />
              <Req label="Кбе" value={seller.kbe ?? "—"} width="15%" />
            </View>
            <View style={[s.tr]}>
              <Req label="Банк бенефициара" value={seller.bank_name ?? "—"} width="50%" />
              <Req label="БИК" value={seller.bik ?? "—"} width="35%" />
              <Req label="Код назначения платежа" value={seller.knp} width="15%" />
            </View>
          </View>

          <View>
            <Text style={s.title}>Счёт на оплату № {order.invoice_number} от {date}</Text>
          </View>

          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: 80, color: C.muted }}>Поставщик:</Text>
              <Text style={{ flex: 1 }}>
                <Text style={s.strong}>БИН {seller.bin}, {seller.name}</Text>
                {seller.address ? `, ${seller.address}` : ""}, тел. {seller.phone}
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: 80, color: C.muted }}>Покупатель:</Text>
              <Text style={{ flex: 1 }}>
                <Text style={s.strong}>БИН {doc.company.bin}, {companyTitle(doc.company)}</Text>
                {doc.company.address ? `, ${doc.company.address}` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: 80, color: C.muted }}>Основание:</Text>
              <Text style={{ flex: 1 }}>Коммерческое предложение № {doc.number} от {formatDocDate(doc.created_at)}</Text>
            </View>
          </View>

          <View style={s.table}>
            <View style={s.th} fixed>
              <Text style={[s.cell, s.center, { width: W.n }]}>№</Text>
              <Text style={[s.cell, { width: W.name }]}>Наименование</Text>
              <Text style={[s.cell, s.right, { width: W.qty }]}>Кол-во</Text>
              <Text style={[s.cell, s.center, { width: W.unit }]}>Ед.</Text>
              <Text style={[s.cell, s.right, { width: W.price }]}>Цена, ₸</Text>
              <Text style={[s.cell, s.right, { width: W.sum }]}>Сумма, ₸</Text>
            </View>
            {doc.lines.map((l, i) => (
              <View key={l.line_no} style={[s.tr, i % 2 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
                <Text style={[s.cell, s.center, { width: W.n }]}>{l.line_no}</Text>
                <Text style={[s.cell, { width: W.name }]}>
                  {l.name}
                  {l.mark ? <Text style={{ color: C.muted }}>{`, ${l.mark}`}</Text> : null}
                </Text>
                <Text style={[s.cell, s.right, { width: W.qty }]}>{qtyText(l.qty)}</Text>
                <Text style={[s.cell, s.center, { width: W.unit }]}>{l.unit}</Text>
                <Text style={[s.cell, s.right, { width: W.price }]}>{moneyText(l.price_kzt)}</Text>
                <Text style={[s.cell, s.right, { width: W.sum, fontWeight: 600 }]}>{moneyText(Math.round(l.qty * l.price_kzt))}</Text>
              </View>
            ))}
            {doc.delivery_kzt > 0 ? (
              <View style={s.tr} wrap={false}>
                <Text style={[s.cell, s.center, { width: W.n }]}>{doc.lines.length + 1}</Text>
                <Text style={[s.cell, { width: W.name }]}>Доставка</Text>
                <Text style={[s.cell, s.right, { width: W.qty }]}>1</Text>
                <Text style={[s.cell, s.center, { width: W.unit }]}>усл.</Text>
                <Text style={[s.cell, s.right, { width: W.price }]}>{moneyText(doc.delivery_kzt)}</Text>
                <Text style={[s.cell, s.right, { width: W.sum, fontWeight: 600 }]}>{moneyText(doc.delivery_kzt)}</Text>
              </View>
            ) : null}
          </View>

          <View style={s.totals} wrap={false}>
            <View style={s.totalBar}>
              <Text>Итого к оплате</Text>
              <Text>{moneyText(order.total_kzt)} ₸</Text>
            </View>
            <View style={s.totalRow}>
              <Text>в т.ч. НДС 16%</Text>
              <Text>{moneyText(order.vat_kzt)} ₸</Text>
            </View>
          </View>
          <Text style={s.words}>
            Всего наименований {doc.lines.length + (doc.delivery_kzt > 0 ? 1 : 0)}, на сумму {moneyText(order.total_kzt)} KZT
          </Text>
          <Text style={s.words}>
            Всего к оплате: <Text style={s.strong}>{amountInWordsKzt(order.total_kzt)}</Text>
          </Text>
          {doc.delivery_method !== "pickup" && doc.delivery_kzt === 0 ? (
            <Text style={{ fontSize: 8, color: C.muted }}>Доставка в счёт не включена и оплачивается отдельно.</Text>
          ) : null}

          <Signature seller={seller} role="Исполнитель" images={doc.images} />
        </View>
        <PageFooter text={`Счёт № ${order.invoice_number} · ${siteConfig.phone}`} />
      </Page>
    </Document>
  );
}
