import path from "node:path";
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DocSeller, QuoteDoc } from "@/lib/documents";

// Фирменный стиль КП AIMAG: тёмно-синяя шапка, янтарная полоса, Inter.
export const C = {
  navy: "#121D2B",
  amber: "#FFB300",
  amberSoft: "#FFF4D6",
  ink: "#162436",
  muted: "#5E6B79",
  line: "#D5DCE5",
  zebra: "#F3F5F8",
};

let fontsReady = false;
export function registerFonts() {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "src/assets/fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]); // no hyphenation in Russian names and marks
  fontsReady = true;
}

const NUM = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
const MONEY = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const qtyText = (n: number) => NUM.format(n);
export const moneyText = (n: number) => MONEY.format(n);

export const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, color: C.ink, paddingBottom: 48 },
  header: { backgroundColor: C.navy, color: "#FFFFFF", paddingHorizontal: 36, paddingVertical: 18, flexDirection: "row", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 22, height: 22, backgroundColor: C.amber, borderRadius: 4 },
  brand: { fontSize: 14, fontWeight: 700 },
  brandSub: { fontSize: 14, fontWeight: 400, color: "#9CAEBF" },
  reqCol: { width: 230, gap: 2, fontSize: 8, color: "#E4E9F0" },
  reqStrong: { fontSize: 9, fontWeight: 700, color: "#FFFFFF" },
  stripe: { height: 4, backgroundColor: C.amber },
  body: { paddingHorizontal: 36, paddingTop: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: 700, color: C.navy },
  subtitle: { fontSize: 9, color: C.muted, marginTop: 3 },
  box: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 10, gap: 3 },
  label: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  strong: { fontWeight: 700 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 4 },
  th: { flexDirection: "row", backgroundColor: C.navy, color: "#FFFFFF", fontWeight: 600, fontSize: 8 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line },
  cell: { paddingVertical: 5, paddingHorizontal: 5 },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  totals: { alignSelf: "flex-end", width: 260, gap: 4 },
  totalBar: { backgroundColor: C.amber, color: C.navy, flexDirection: "row", justifyContent: "space-between", padding: 8, borderRadius: 3, fontWeight: 700, fontSize: 11 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
  words: { fontSize: 8.5 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: C.navy, marginBottom: 4 },
  bullet: { flexDirection: "row", gap: 5, marginBottom: 2 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
});

export function DocHeader({ seller }: { seller: DocSeller }) {
  return (
    <>
      <View style={s.header}>
        <View style={{ justifyContent: "center", gap: 4 }}>
          <View style={s.brandRow}>
            <View style={s.brandMark} />
            <Text style={s.brand}>
              AIMAG <Text style={s.brandSub}>Stroymateriali</Text>
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: "#9CAEBF" }}>Стройматериалы оптом для ТОО и ИП</Text>
        </View>
        <View style={s.reqCol}>
          <Text style={s.reqStrong}>{seller.name}</Text>
          <Text>БИН {seller.bin}{seller.vat_payer ? " · плательщик НДС" : ""}</Text>
          {seller.address ? <Text>{seller.address}, Республика Казахстан</Text> : <Text>Республика Казахстан</Text>}
          {seller.bank_name && seller.bik ? <Text>{seller.bank_name}, БИК {seller.bik}</Text> : null}
          {seller.iban ? <Text>ИИК {seller.iban}</Text> : null}
          <Text>Тел. {seller.phone}</Text>
        </View>
      </View>
      <View style={s.stripe} />
    </>
  );
}

export { companyTitle } from "@/lib/company-title";

/** Director line, with the seller's stamp and signature embedded when they are uploaded. */
export function Signature({ seller, role, images }: { seller: DocSeller; role: string; images?: QuoteDoc["images"] }) {
  const stamp = images?.stamp;
  const sign = images?.signature;
  return (
    <View style={{ marginTop: 14, height: 90, justifyContent: "center" }} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Text style={{ fontWeight: 600 }}>{role} {seller.name}</Text>
        <View style={{ width: 110, borderBottomWidth: 1, borderBottomColor: C.ink, height: 14 }} />
        <Text>/ {seller.director} /</Text>
      </View>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {sign ? <Image src={sign} style={{ position: "absolute", left: 150, top: 10, width: 90, height: 40, objectFit: "contain" }} /> : null}
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {stamp ? <Image src={stamp} style={{ position: "absolute", left: 120, top: 0, width: 90, height: 90, objectFit: "contain", opacity: 0.9 }} /> : null}
    </View>
  );
}

export function PageFooter({ text }: { text: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{text}</Text>
      <Text render={({ pageNumber, totalPages }) => `Стр. ${pageNumber} из ${totalPages}`} />
    </View>
  );
}
