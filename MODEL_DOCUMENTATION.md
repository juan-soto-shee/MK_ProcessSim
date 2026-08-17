# MK ProcessSim — Documentación del modelo agua–pulpa

Fecha: 2026-08-16

## Convención de unidades

- Sólidos y agua en corrientes: t/h. Para agua, `1 t/h = 1 m³/h` con `ρw = 1 t/m³`.
- Inventarios: t.
- Volumen y caudal: m³ y m³/h.
- Tamaño: µm.
- Tiempo interno: min; el paso del solver entra en segundos y se convierte una sola vez.
- Potencia y energía: kW y kWh/t.

## Estados dinámicos

El estado contiene `millMass[i]`, `millWater`, `sumpMass[i]` y `sumpWater`. Los sólidos se representan en 20 clases entre 25 400 y 38 µm.

## Balance de sólidos — BALANCE

Para cada clase `i` del molino:

`dMmill,i/dt = Ffresh,i + FUF,i - Fmill,out,i + Bi`

Para el sump:

`dMsump,i/dt = Fmill,out,i - Fpump,i`

`Bi` transfiere masa entre clases y su suma es cero. El ciclón cumple por construcción:

`Fcyclone,i = FUF,i + FOF,i`

En estado estacionario `FOF,s ≈ Ffresh,s`. La carga circulante es exclusivamente:

`CL = FUF,s / Ffresh,s · 100`

## Balance de agua — BALANCE

Molino:

`dWmill/dt = Wfresh,mill + Wmoisture + WUF - Wmill,out`

Sump:

`dWsump/dt = Wmill,out + Wfresh,sump - Wpump`

Ciclón:

`Wpump = WUF + WOF`

Los residuos reportados restan además la acumulación correspondiente, por lo que son cero también durante transitorios.

## Humedad de alimentación — FÍSICA

La alimentación especificada es sólido seco:

`Wmoisture = Ffresh,s · moisture / (100 - moisture)`

Rango de interfaz: 0–100 %, aunque operacionalmente debe mantenerse muy por debajo de 100 %.

## Propiedades de pulpa — FÍSICA

`%Sw = Ms / (Ms + Mw) · 100`

`Qp = Ms/ρs + Mw/ρw`

`ρp = (Ms + Mw) / Qp`

Se usa `ρw = 1 t/m³` y `ρs` configurable. Las mismas ecuaciones se aplican a inventarios y corrientes.

## Molino — EMPÍRICA/CALIBRABLE CON LÍMITE ENERGÉTICO

La descarga usa mezcla perfecta con `Fout,i = Mmill,i / τhold`. La rotura base es de primer orden y conserva masa. La demanda energética se calcula sobre la masa que el PBM intenta romper, usando el incremento de Bond entre cada clase padre y sus clases hijas 72/28 %. La potencia efectiva es `min(P_available, P_required)` y las tasas de rotura se reducen por `min(1, P_available/P_required)`. Así, al saturarse el motor cae la energía específica disponible y el producto se engruesa. Wi, cinética y distribución de hijas siguen siendo calibrables y no están validados con planta.

## Sump — BALANCE/FÍSICA

Se supone mezcla perfecta. El volumen es:

`Vsump = Msump/ρs + Wsump/ρw`

`Level = Vsump / Vsump,max · 100`

Alarmas: menor que 10 % nivel bajo, mayor que 90 % nivel alto y desde 100 % rebalse. El motor informa el rebalse; no elimina masa silenciosamente.

## Bomba — PROVISIONAL

Demanda base:

`Qdemand = Qmax · Neffective/100`

`Neffective = clamp(Nbias + Klevel(Level - SP), 0, 100)`

El flujo queda limitado por capacidad y volumen disponible. La extracción usa la composición instantánea del sump. Es una aproximación de primera etapa; no reemplaza una curva bomba–sistema.

## Ciclón: partición de sólidos — EMPÍRICA/CALIBRABLE

`Ei = bypass + (1-bypass) / [1 + (d50c/di)^s]`

`s` depende de la imperfección. `FUF,i = Ei Ffeed,i` y `FOF,i = (1-Ei)Ffeed,i`.

## Corrección d50c — PROVISIONAL/CALIBRABLE

Se aplica una corrección adimensional alrededor de `d50cBase` con exponentes suaves de presión, caudal por ciclón, densidad, diámetro, apex y vortex finder. El resultado se limita entre 0,45 y 2,2 veces el d50 base. Esta relación solo provee arquitectura y respuesta operativa coherente; no está validada como correlación de diseño.

## Recuperación de agua al underflow — PROVISIONAL/CALIBRABLE

La recuperación se limita entre bypass y 88 %, y depende del split de sólidos y de la relación apex/vortex. Se conserva agua exactamente, pero la distribución UF/OF debe calibrarse con survey de ciclones.

## Presión

La presión de alimentación es una entrada operativa y participa únicamente en la corrección provisional de d50. El modelo no calcula presión desde una curva hidráulica ni afirma reproducir la pérdida de carga de una batería real.

## Integración y estabilidad

El integrador es RK4 con subpasos. El detector exige simultáneamente baja tasa de cambio de P80 OF, CL, inventario del molino, nivel de sump, densidad del ciclón y FUF durante una ventana continua de 2 minutos, además de conservación de sólidos y agua.

El reloj separa explícitamente `wallDeltaSec`, `speedMultiplier`, `simDeltaSec` y `solverMaxDtSec`, con `simDeltaSec = wallDeltaSec · speedMultiplier`. La velocidad es una propiedad del reloj, no de las ecuaciones físicas. La frecuencia de render no forma parte del estado ni de las derivadas.

## P80

El P80 se obtiene de la curva acumulada mediante interpolación lineal en fracción pasante y logarítmica en tamaño. La PSD se normaliza internamente. En distribuciones fuera de resolución o degeneradas, el resultado queda limitado explícitamente al intervalo de clases `[38, 25 400] µm`; no se extrapola fuera de la malla.

## Validación

- Balances de sólidos/agua y propiedades de pulpa: verificados matemáticamente.
- Integración, reloj 1×/5×/10×/20×, render 30/60/120 FPS, no deriva y conservación de 10/60/240 minutos: verificadas numéricamente.
- Antes de introducir el límite energético, el arranque tardaba 537,7 min en permanecer dentro de las tolerancias durante 5 min; F_UF era la variable gobernante. En el modelo cerrado, sin modificar tau ni PI, F_UF presenta T95=125,83 min y T99=151,17 min. La mejora proviene del cambio de PSD/recirculación, no de calibrar el criterio para obtener PASS.
- Modelos de molienda, bomba, d50 y water split: implementados, no validados contra datos.
- Comparación con BALLSIM, Moly-Cop u otro software comercial: no realizada.

## Capacidad y estados de factibilidad

Los resultados de pruebas y la factibilidad del proceso son conceptos separados. La suite verifica que los detectores reconozcan restricciones en vez de exigir una falsa convergencia. Con la hidráulica base, 100 t/h es factible y el primer punto discreto excedido es 125 t/h. En el escenario diagnóstico con hidráulica no limitante, 125 t/h usa aproximadamente 2109 kW y 150 t/h requiere aproximadamente 5413 kW frente a 2200 kW disponibles; el límite energético queda entre ambos puntos. A 150 y 200 t/h se conservan estados de capacidad excedida, no PASS de proceso.

El límite de ciclones no fue evaluado por falta de una correlación o datos calibrados. Véanse `ENERGY_MODEL_DIAGNOSTIC.md`, `DYNAMIC_RESPONSE_DIAGNOSTIC.md` y `CAPACITY_DIAGNOSTIC.md`.
