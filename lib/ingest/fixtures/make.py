# Regenerates the binary fixtures: python3 lib/ingest/fixtures/make.py (stdlib only).
import zipfile, os
d = os.path.dirname(os.path.abspath(__file__))

def pdf(pages, path):
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", None, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in pages:
        n = len(objs) + 1
        kids.append(f"{n} 0 R")
        body = "BT /F1 11 Tf 14 TL 50 780 Td " + " ".join(f"({l.replace('(', '[').replace(')', ']')}) Tj T*" for l in lines) + " ET"
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {n + 1} 0 R >>".encode())
        objs.append(f"<< /Length {len(body)} >>\nstream\n{body}\nendstream".encode())
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>".encode()
    out, offs = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offs)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()
    open(os.path.join(d, path), "wb").write(out)

pdf([["Deprecation policy", "API v1 is retired on 2027-01-31."], ["Migration", "Customers move to API v2 by December."]], "two-page.pdf")
pdf([["Master Services Agreement", "Between Ledgerly and Northwind Capital.", "1. Definitions", "1.1 Service means the Ledgerly API platform.",
      "7.2 API v1 availability. Ledgerly guarantees availability of API v1 until 2027-06-30."],
     ["9.1 Security report. Ledgerly delivers an annual security report by 2026-12-01.", "11.1 Liability. Liability is uncapped for data breaches."]], "contract.pdf")

paras = ["Launch checklist", "Ship the new billing page by Friday.", "Ana owns the rollout."]
doc = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paras)
with zipfile.ZipFile(os.path.join(d, "memo.docx"), "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    z.writestr("word/document.xml", f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{doc}</w:body></w:document>')
