import {
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { join } from "node:path";

Font.register({
  family: "Geist",
  src: join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "compiled",
    "@vercel",
    "og",
    "Geist-Regular.ttf",
  ),
});

export type QuotePdfData = {
  businessName: string;
  businessPhone: string | null;
  businessEmail: string | null;
  quoteNumber: string;
  date: string;
  validUntil: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  items: {
    service: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  deliveryCharge: number;
  total: number;
  terms: string | null;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingRight: 48,
    paddingBottom: 48,
    paddingLeft: 48,
    backgroundColor: "#ffffff",
    color: "#000000",
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  section: { marginTop: 22 },
  label: { fontSize: 8, textTransform: "uppercase" },
  value: { marginTop: 4, fontSize: 10 },
  business: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  meta: { marginTop: 4 },
  table: { marginTop: 22 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#555555",
    paddingBottom: 6,
    marginBottom: 5,
  },
  row: { flexDirection: "row", paddingVertical: 5 },
  service: { flex: 4 },
  quantity: { flex: 1, textAlign: "right", fontFamily: "Courier" },
  price: { flex: 2, textAlign: "right", fontFamily: "Courier" },
  money: { flex: 2, flexDirection: "row", justifyContent: "flex-end" },
  moneyAmount: { fontFamily: "Courier" },
  currencySymbol: { fontFamily: "Geist" },
  totals: { width: 230, alignSelf: "flex-end", marginTop: 18 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  total: { marginTop: 5, fontFamily: "Helvetica-Bold" },
  terms: { marginTop: 8, lineHeight: 1.5 },
});

function Money({ value }: { value: number }) {
  const parts = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).formatToParts(value);

  return (
    <View style={styles.money}>
      {parts.map((part, index) => (
        <Text
          key={`${part.type}-${index}`}
          style={
            part.type === "currency" || part.type === "minusSign"
              ? styles.currencySymbol
              : styles.moneyAmount
          }
        >
          {part.value}
        </Text>
      ))}
    </View>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-IN",
    { timeZone: "UTC", dateStyle: "medium" },
  );
}

export function QuotePdfPage({ quote }: { quote: QuotePdfData }) {
  return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.business}>{quote.businessName}</Text>
        {quote.businessPhone && (
          <Text style={styles.meta}>{quote.businessPhone}</Text>
        )}
        {quote.businessEmail && (
          <Text style={styles.meta}>{quote.businessEmail}</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.title}>Quotation</Text>
          <Text style={styles.value}>Quote number: {quote.quoteNumber}</Text>
          <Text style={styles.value}>Date: {formatDate(quote.date)}</Text>
          <Text style={styles.value}>
            Valid until: {formatDate(quote.validUntil)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Prepared for</Text>
          <Text style={styles.value}>{quote.customerName}</Text>
          {quote.customerPhone && (
            <Text style={styles.value}>{quote.customerPhone}</Text>
          )}
          {quote.customerEmail && (
            <Text style={styles.value}>{quote.customerEmail}</Text>
          )}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.service, styles.label]}>Service</Text>
            <Text style={[styles.quantity, styles.label]}>Qty</Text>
            <Text style={[styles.price, styles.label]}>Unit price</Text>
            <Text style={[styles.price, styles.label]}>Amount</Text>
          </View>
          {quote.items.map((item, index) => (
            <View key={`${item.service}-${index}`} style={styles.row}>
              <Text style={styles.service}>{item.service}</Text>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <Money value={item.unitPrice} />
              <Money value={item.lineTotal} />
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Money value={quote.subtotal} />
          </View>
          <View style={styles.totalRow}>
            <Text>Discount</Text>
            <Money value={-quote.discount} />
          </View>
          <View style={styles.totalRow}>
            <Text>GST ({quote.taxPercent}%)</Text>
            <Money value={quote.taxAmount} />
          </View>
          <View style={styles.totalRow}>
            <Text>Delivery</Text>
            <Money value={quote.deliveryCharge} />
          </View>
          <View style={[styles.totalRow, styles.total]}>
            <Text>Total</Text>
            <Money value={quote.total} />
          </View>
        </View>

        {quote.terms && (
          <View style={styles.section}>
            <Text style={styles.label}>Terms</Text>
            <Text style={styles.terms}>{quote.terms}</Text>
          </View>
        )}
      </Page>
  );
}
