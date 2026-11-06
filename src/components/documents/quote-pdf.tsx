import { Document, Page, Text, View } from "@react-pdf/renderer";
import { amountInWordsKzt } from "@/lib/amount-in-words";
import { deliveryLabel, formatDocDate, type QuoteDoc } from "@/lib/documents";
import { siteConfig } from "@/config/site";
import { C, DocHeader, PageFooter, Signature, companyTitle, moneyText, qtyText, s } from "./pdf-base";

// № · Наименование · Тип/марка · Ед. · Кол-во · Цена с НДС · Сумма с НДС
const W = { n: "4%", name: "32%", mark: "17%", unit: "6%", qty: "9%", price: "15%", sum: "17%" };

export function QuotePdf({ doc }: { doc: QuoteDoc }) {
  const date = formatDocDate(doc.created_at);
  const until = formatDocDate(doc.valid_until);
  const delivery = deliveryLabel[doc.delivery_method ?? "pickup"] ?? deliveryLabel.pickup;
  const deliveryWhere = [doc.delivery_city, doc.delivery_address].filter(Boolean).join(", ");

  return (
    <Document title={`Коммерческое предложение ${doc.number}`} author={doc.seller.name} language="ru">
      <Page size="A4" style={s.page}>
        <DocHeader seller={doc.seller} />
        <View style={s.body}>
          <View>
            <Text style={s.title}>Коммерческое предложение</Text>
            <Text style={s.subtitle}>
              № {doc.number} от {date} · действительно 7 календарных дней, до {until}
            </Text>
          </View>

          <View style={[s.box, { backgroundColor: C.zebra, borderColor: C.zebra }]}>
            <Text style={s.label}>Кому</Text>
            <Text style={s.strong}>{companyTitle(doc.company)}</Text>
            <Text>
              БИН {doc.company.bin}
              {doc.company.address ? ` · ${doc.company.address}` : ""}
            </Text>
            <Text style={{ marginTop: 4 }}>
              {doc.seller.name} предлагает поставку строительных материалов по вашему запросу. Цены указаны в тенге с НДС 16%.
            </Text>
          </View>

          <View style={s.table}>
            <View style={s.th} fixed>
              <Text style={[s.cell, s.center, { width: W.n }]}>№</Text>
              <Text style={[s.cell, { width: W.name }]}>Наименование</Text>
              <Text style={[s.cell, { width: W.mark }]}>Тип / марка</Text>
              <Text style={[s.cell, s.center, { width: W.unit }]}>Ед.</Text>
              <Text style={[s.cell, s.right, { width: W.qty }]}>Кол-во</Text>
              <Text style={[s.cell, s.right, { width: W.price }]}>Цена с НДС, ₸</Text>
              <Text style={[s.cell, s.right, { width: W.sum }]}>Сумма с НДС, ₸</Text>
            </View>
            {doc.lines.map((l, i) => (
              <View key={l.line_no} style={[s.tr, i % 2 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
                <Text style={[s.cell, s.center, { width: W.n }]}>{l.line_no}</Text>
                <Text style={[s.cell, { width: W.name }]}>{l.name}</Text>
                <Text style={[s.cell, { width: W.mark, color: C.muted }]}>{l.mark ?? "—"}</Text>
                <Text style={[s.cell, s.center, { width: W.unit }]}>{l.unit}</Text>
                <Text style={[s.cell, s.right, { width: W.qty }]}>{qtyText(l.qty)}</Text>
                <Text style={[s.cell, s.right, { width: W.price }]}>{moneyText(l.price_kzt)}</Text>
                <Text style={[s.cell, s.right, { width: W.sum, fontWeight: 600 }]}>{moneyText(Math.round(l.qty * l.price_kzt))}</Text>
              </View>
            ))}
          </View>

          <View style={s.totals} wrap={false}>
            {doc.delivery_kzt > 0 ? (
              <>
                <View style={s.totalRow}>
                  <Text>Товары</Text>
                  <Text>{moneyText(doc.goods_kzt)} ₸</Text>
                </View>
                <View style={s.totalRow}>
                  <Text>Доставка</Text>
                  <Text>{moneyText(doc.delivery_kzt)} ₸</Text>
                </View>
              </>
            ) : null}
            <View style={s.totalBar}>
              <Text>Итого с НДС</Text>
              <Text>{moneyText(doc.total_kzt)} ₸</Text>
            </View>
            <View style={s.totalRow}>
              <Text>в т.ч. НДС 16%</Text>
              <Text>{moneyText(doc.vat_kzt)} ₸</Text>
            </View>
          </View>
          <Text style={s.words}>
            Всего наименований {doc.lines.length}, на сумму: <Text style={s.strong}>{amountInWordsKzt(doc.total_kzt)}</Text>
          </Text>

          <View wrap={false}>
            <Text style={s.sectionTitle}>Условия поставки</Text>
            {[
              "Цены указаны в тенге, включая НДС 16%.",
              "Оплата: по счёту до отгрузки; товар под заказ — 100% предоплата.",
              "Срок поставки: товар в наличии — после поступления оплаты; товар под заказ — срок согласовывается с менеджером.",
              `Доставка: ${delivery}${deliveryWhere ? ` (${deliveryWhere})` : ""}.${doc.delivery_method !== "pickup" && doc.delivery_kzt === 0 ? " Стоимость доставки рассчитывается отдельно." : ""}`,
              "Документы: накладная, электронный счёт-фактура (ЭСФ), сертификаты или паспорта качества.",
              `Предложение действительно 7 календарных дней — до ${until}.`,
            ].map((t) => (
              <View key={t} style={s.bullet}>
                <Text style={{ color: C.amber, fontWeight: 700 }}>•</Text>
                <Text style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>

          <Signature seller={doc.seller} role="Директор" images={doc.images} />
        </View>
        <PageFooter text={`${doc.number} · вопросы по предложению: ${siteConfig.phone}`} />
      </Page>
    </Document>
  );
}
