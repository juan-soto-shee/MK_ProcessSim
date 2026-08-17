# Diagnóstico del modelo energético

Fecha: 2026-08-17

## Causa raíz anterior

El modelo anterior calculaba `Power ∝ M_mill` entre 15,3 y 85 t y usaba `Power/(Wi·M_mill)` en la rotura. Inventario y potencia se cancelaban; hasta 250 t/h no aparecía una región limitada por energía y la potencia solo alcanzaba 585,88 kW.

## Formulación implementada

Bond se mantiene como auditoría energética incremental, no como sustituto del PBM. F80, tamaños padre e hijos están en µm y Wi en kWh/t:

`Eij = 10 Wi (1/sqrt(dhija) - 1/sqrt(dpadre))`

Para cada clase, la demanda usa la masa que el PBM intenta romper y la energía de sus hijas 72/28 %. Esto evita cobrar F80→P80 nuevamente a toda la carga circulante.

`P_required,net = Σ broken_i(t/h) · (0,72 Ei,i+1 + 0,28 Ei,i+2)`

`P_required = P_required,net / eficiencia`

`P_available = potencia instalada disponible a la velocidad configurada`

`P_used = min(P_available, P_required)`

`energyAvailability = min(1, P_available/P_required)`

Las tasas efectivas son `S_i,eff = S_i,base · energyAvailability`. El escalamiento lineal es consistente porque la demanda calculada es lineal con la tasa de eventos de rotura.

Se reportan separadamente `P_available`, `P_required`, `P_used`, energía por tonelada fresca y por tonelada de flujo de molino. `Power_mill` queda como alias compatible de `P_used`.

## Capacidad energética predicha

En el escenario diagnóstico con bomba no limitante, 125 t/h permanece normal (`P_required≈2109 kW`) y 150 t/h entra en régimen `ENERGY_LIMITED` (`P_required≈5413 kW`, `energyAvailability≈0,406`) y converge. El inicio predicho está entre 125 y 150 t/h; no se refinó más por cierre de iteración.

Desde 175 t/h los casos no alcanzan convergencia numérica en 1800 min y desarrollan carga circulante muy alta. No deben interpretarse como estados estacionarios.

Con la hidráulica base, el primer punto discreto detectado como `HYDRAULIC_CAPACITY_EXCEEDED` es 125 t/h. A 150 t/h y superiores aparecen restricciones energética e hidráulica simultáneas.

## Limitaciones

- Modelo implementado y verificado matemática/numéricamente, pero no validado contra planta.
- Energías por clase usan los tamaños de la malla como representativos.
- La tasa base de rotura y su distribución 72/28 siguen siendo calibrables.
- No existe criterio validado de capacidad máxima de ciclones; se reporta `NOT_ASSESSED_CALIBRATION_REQUIRED`.
- El escenario de bomba alta es diagnóstico y no cambia los defaults.

## Pendientes

- Calibrar demanda y tasa de rotura con potencia/planta.
- Refinar el umbral entre 125 y 150 t/h.
- Incorporar una capacidad de ciclón respaldada por correlación o datos.
