-- Вес единицы товара (кг) для расчёта доставки. НЕ миграция.
-- Паспортные данные производителей и справочные нормы; округлено вверх с учётом упаковки.
begin;
update products p set weight_kg = w.kg, updated_at = now()
from (values
  ('MKT-ARM-A500C-12', 1000),        -- т
  ('MKT-CEM-M500-50', 50),
  ('MKT-CERESIT-CM11-25', 25),
  ('MKT-ROTBAND-30', 30),
  ('MKT-GKL-KNAUF-12.5', 27),        -- лист 1200×2500
  ('MKT-GKLV-KNAUF-12.5', 28),
  ('MKT-PROF-PP6027-3', 1.6),
  ('MKT-MW-KNAUF-50', 0.8),          -- м², плита 50 мм
  ('MKT-PSB-S25-50', 17),            -- м³
  ('MKT-IZOSPAN-A-70', 7),
  ('MKT-IZOSPAN-AM-70', 7),
  ('MKT-MT-045-PE-3005', 4.5),       -- м², сталь 0,45 мм
  ('MKT-MT-045-PE-6005', 4.5),
  ('MKT-MT-045-PE-8017', 4.5),
  ('MKT-PN-C21-050-PE-3005', 5),     -- м², сталь 0,5 мм
  ('MKT-PN-C21-050-PE-6005', 5),
  ('MKT-PN-C21-050-PE-8017', 5),
  ('MKT-PN-C8-040-ZN', 3.9),
  ('MKT-RIDGE-PE-3005', 1.5),        -- м
  ('MKT-RIDGE-PE-6005', 1.5),
  ('MKT-RIDGE-PE-8017', 1.5),
  ('MKT-SCR-4.8X35-3005', 1.5),      -- уп. 250 шт
  ('MKT-SCR-4.8X35-6005', 1.5),
  ('MKT-SCR-4.8X35-8017', 1.5),
  ('MKT-GUT-125-3M-8017', 2.5),
  ('MKT-GUT-125-3M-9003', 2.5),
  ('MKT-SIDING-PVC-SHIP-3M', 1.0),
  ('MKT-SIDING-J-PVC-3M', 0.6),
  ('MKT-PANEL-DOCKE-FELS', 1.6),
  ('MKT-PANEL-DOCKE-KLINKER', 1.6),
  ('MKT-VF-BRACKET-120', 0.25),
  ('MKT-PE-32', 0.2),                -- м
  ('MKT-PEF-COUPLING-32', 0.12),
  ('MKT-PPR-20-PN20', 0.17),
  ('MKT-PPR-25-PN20', 0.27),
  ('MKT-PPR-32-PN20', 0.43),
  ('MKT-PPRF-COUPLING-25', 0.02),
  ('MKT-PPRF-ELBOW90-25', 0.03),
  ('MKT-SEW-110-2M', 2.4),
  ('MKT-VALVE-BALL-1/2', 0.15),
  ('MKT-VVGNG-3X1.5', 0.12),         -- м
  ('MKT-VVGNG-3X2.5', 0.17),
  ('MKT-TOOL-MAKITA-9558HN', 2.6),
  ('MKT-TOOL-MAKITA-HR2470', 5),
  ('MKT-TOOL-MAKITA-DF333', 2.5),
  ('MKT-TOOL-LEVEL-1000', 0.5),
  ('MKT-TOOL-TAPE-5M', 0.2),
  ('MKT-EQ-MIXER-VIHR-180', 45),
  ('MKT-EQ-BARROW-100-2W', 18),
  ('MKT-EQ-WELD-RESANTA-220', 5),
  ('MKT-CONS-CUT-125-1.2', 0.06),
  ('MKT-CONS-BUR-SDS-10-160', 0.1),
  ('MKT-CONS-DIAM-125-SEG', 0.25)
) as w(sku, kg)
where p.sku = w.sku;
commit;
